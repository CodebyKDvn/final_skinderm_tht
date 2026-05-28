from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import random
import time
import asyncio
import requests
import json
import numpy as np
import cv2
import albumentations as A
from albumentations.pytorch import ToTensorV2
import segmentation_models_pytorch as smp

import torch
import torch.nn as nn
import timm
from torchvision import transforms
import torchvision.transforms.functional as TF
from PIL import Image
import io
import os
from dotenv import load_dotenv
from firebase_admin_utils import firebase_auth_manager
from openai import OpenAI
from apscheduler.schedulers.background import BackgroundScheduler
from explore_agent import run_explore_workflow, get_latest_blogs
import threading

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Skinderm AI Backend API", version="1.0.0")

# --- NVIDIA AI Client ---
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
nv_client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = NVIDIA_API_KEY,
  timeout = 30.0,
  max_retries = 0
)

# --- Local Storage & SQLite Configuration ---
import sqlite3
import uuid
from fastapi.staticfiles import StaticFiles

# --- Local Storage & SQLite Configuration ---
import sqlite3
import uuid
from fastapi.staticfiles import StaticFiles

# Cấu hình đường dẫn lưu trữ (Ưu tiên từ .env, sau đó là ổ D, cuối cùng là thư mục hiện tại)
STORAGE_ROOT = os.getenv("STORAGE_ROOT", "D:/")
if not os.path.exists(STORAGE_ROOT) and STORAGE_ROOT == "D:/":
    STORAGE_ROOT = os.getcwd()
elif not os.path.exists(STORAGE_ROOT):
    os.makedirs(STORAGE_ROOT, exist_ok=True)

DB_PATH = os.path.join(STORAGE_ROOT, "skinderm.db")
STORAGE_PATH = os.path.join(STORAGE_ROOT, "skinderm_storage")

# Đảm bảo thư mục lưu trữ ảnh tồn tại
if not os.path.exists(STORAGE_PATH):
    try:
        os.makedirs(STORAGE_PATH, exist_ok=True)
        print(f"[OK] Created Storage directory: {STORAGE_PATH}")
    except Exception as e:
        # Fallback cuối cùng nếu vẫn lỗi quyền ghi
        STORAGE_ROOT = os.getcwd()
        STORAGE_PATH = os.path.join(STORAGE_ROOT, "skinderm_storage")
        DB_PATH = os.path.join(STORAGE_ROOT, "skinderm.db")
        os.makedirs(STORAGE_PATH, exist_ok=True)
        print(f"[WARN] Fallback to project directory due to error: {e}")


def init_local_db():
    """Khởi tạo bảng SQLite nếu chưa có."""
    global DB_PATH
    try:
        conn = sqlite3.connect(DB_PATH)
    except Exception:
        # Nếu vẫn không mở được (ví dụ ổ D có tồn tại nhưng Read-only)
        DB_PATH = os.path.join(os.getcwd(), "skinderm.db")
        conn = sqlite3.connect(DB_PATH)
        
    try:
        cursor = conn.cursor()
        # Bảng lịch sử quét da
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analysis_records (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                image_url TEXT NOT NULL,
                risk_score REAL NOT NULL,
                classification TEXT NOT NULL,
                confidence REAL NOT NULL,
                abcde TEXT, 
                top3 TEXT,  
                uv_index REAL,
                temperature REAL,
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Bảng quản lý nốt ruồi
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS moles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                body_part TEXT,
                notes TEXT,
                status TEXT DEFAULT 'monitoring',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
        print(f"[OK] Local Database initialized at {DB_PATH}")
    except Exception as e:
        print(f"[ERROR] Could not initialize database at {DB_PATH}: {e}")

init_local_db()

# Mount thư mục ảnh để có thể truy cập qua URL (ví dụ: http://localhost:8080/storage/abc.jpg)
app.mount("/storage", StaticFiles(directory=STORAGE_PATH), name="storage")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# 1. DIAGNOSIS ENSEMBLE MODEL (efficientnet_b3 + convnext_tiny) -> 8 classes
# ---------------------------------------------------------
class EnsembleModel(nn.Module):
    def __init__(self, num_classes=8):
        super(EnsembleModel, self).__init__()
        self.backbone1 = timm.create_model('efficientnet_b3', pretrained=False, num_classes=0)
        self.backbone2 = timm.create_model('convnext_tiny', pretrained=False, num_classes=0)
        
        in_features = self.backbone1.num_features + self.backbone2.num_features
        
        self.head = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(512, num_classes)
        )
        
    def forward(self, x):
        features1 = self.backbone1(x)
        features2 = self.backbone2(x)
        features = torch.cat([features1, features2], dim=1)
        return self.head(features)

# ---------------------------------------------------------
# 1b. CONVNEXTV2-TINY MODEL (standalone) -> 9 classes
# ---------------------------------------------------------
class ConvNextModel(nn.Module):
    def __init__(self, num_classes=9):
        super().__init__()
        self.model = timm.create_model('convnextv2_tiny', pretrained=False, num_classes=num_classes)
    def forward(self, x):
        return self.model(x)

# ---------------------------------------------------------
# 2. SEGMENTATION UNET MODEL (smp.Unet - mit_b5)
# ---------------------------------------------------------
# using segmentation_models_pytorch instead of manual Unet


# ---------------------------------------------------------
# LOAD MODELS
# ---------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
device_type = 'cuda' if torch.cuda.is_available() else 'cpu'

MODEL_LOADED = False
model_a = None
model_b = None

# Trọng số Weighted Ensemble: Model A (xịn hơn) chiếm 60%, Model B 40%
W_A = 0.6
W_B = 0.4

try:
    # 1. Load Model A: EnsembleModel (efficientnet_b3 + convnext_tiny) -> 8 classes
    DIAG_MODEL_PATH_A = "models/best_model_isic2019.pth"
    model_a = EnsembleModel(num_classes=8)
    ckpt_a = torch.load(DIAG_MODEL_PATH_A, map_location=device)
    sd_a = ckpt_a['state_dict'] if 'state_dict' in ckpt_a else ckpt_a
    model_a.load_state_dict(sd_a)
    model_a.to(device)
    model_a.eval()
    print(f"[OK] Loaded Model A (EnsembleModel, 8 classes) onto {device}")
except Exception as e:
    print(f"[WARN] Failed to load Model A: {e}")
    model_a = None

try:
    # 2. Load Model B: ConvNeXtV2-Tiny -> 9 classes
    DIAG_MODEL_PATH_B = "models/best_model.pth"
    model_b = ConvNextModel(num_classes=9)
    ckpt_b = torch.load(DIAG_MODEL_PATH_B, map_location=device)
    sd_b = ckpt_b['state_dict'] if 'state_dict' in ckpt_b else ckpt_b
    # Strip 'model.' prefix if present (checkpoint was saved with a wrapper)
    sd_b = {k[len('model.'):] if k.startswith('model.') else k: v for k, v in sd_b.items()}
    model_b.model.load_state_dict(sd_b)
    model_b.to(device)
    model_b.eval()
    print(f"[OK] Loaded Model B (ConvNeXtV2-Tiny, 9 classes) onto {device}")
except Exception as e:
    print(f"[WARN] Failed to load Model B: {e}")
    model_b = None

try:
    # 3. Load Segmentation Model (mit_b5 Unet)
    SEG_MODEL_PATH = "models/best_mit_b5_unet.pth"
    print("Loading segmentation model (339MB)...")
    model_seg = smp.Unet(
        encoder_name="mit_b5",
        encoder_weights=None, 
        in_channels=3,
        classes=1
    )
    # use map_location=device to load to GPU/CPU correctly
    model_seg.load_state_dict(torch.load(SEG_MODEL_PATH, map_location=device))
    model_seg.to(device)
    model_seg.eval()
    print(f"[OK] Loaded Segmentation Model (mit_b5) onto {device}")
except Exception as e:
    print(f"[WARN] Failed to load Segmentation Model: {e}")

NUM_ENSEMBLE_CLASSES = 9  # max classes across all models

if model_a is not None or model_b is not None:
    MODEL_LOADED = True
    loaded_count = sum(1 for m in [model_a, model_b] if m is not None)
    print(f"\n=== Weighted Ensemble ready with {loaded_count}/2 diagnosis model(s) (W_A={W_A}, W_B={W_B}) ===")
else:
    MODEL_LOADED = False
    print("\n=== No diagnosis models loaded! ===")

LABELS = ["MEL (Melanoma)", "NV (Melanocytic nevus)", "BCC (Basal cell carcinoma)", 
          "AK (Actinic keratosis)", "BKL (Benign keratosis)", "DF (Dermatofibroma)", 
          "VASC (Vascular lesion)", "SCC (Squamous cell carcinoma)", "UNK (Unknown)"]

def calculate_asymmetry(mask):
    """Tính toán mức độ bất đối xứng của nốt ruồi."""
    if np.sum(mask) == 0: return 0
    
    # Tìm tâm của vật thể
    coords = np.column_stack(np.where(mask > 0))
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    
    roi = mask[y_min:y_max+1, x_min:x_max+1]
    h, w = roi.shape
    
    # Lật ảnh theo chiều dọc và ngang
    h_flip = cv2.flip(roi, 1)
    v_flip = cv2.flip(roi, 0)
    
    # So sánh sự khác biệt
    diff_h = np.logical_xor(roi, h_flip).sum()
    diff_v = np.logical_xor(roi, v_flip).sum()
    
    # Chuẩn hóa (0-100)
    total_pixels = roi.sum()
    score = ((diff_h + diff_v) / (2 * total_pixels)) * 100
    return min(100, max(0, float(score)))

def calculate_border(mask):
    """Tính toán độ gồ ghề của đường viền (Circularity)."""
    if np.sum(mask) == 0: return 0
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours: return 0
    
    cnt = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(cnt)
    perimeter = cv2.arcLength(cnt, True)
    
    if perimeter == 0: return 0
    
    # Chỉ số Circularity: 4*pi*A / P^2
    # Hình tròn hoàn hảo có circularity = 1. Càng thấp càng gồ ghề.
    circularity = (4 * np.pi * area) / (perimeter ** 2)
    
    # Chuyển thành thang điểm rủi ro (circularity thấp -> điểm cao)
    score = (1.0 - circularity) * 100
    return min(100, max(0, float(score)))

def calculate_color(image_np, mask):
    """Phân tích sự đa dạng màu sắc bên trong vùng mask."""
    if np.sum(mask) == 0: return 0
    
    # Lấy các pixel bên trong mask
    pixels = image_np[mask > 0]
    
    # Tính độ lệch chuẩn của các kênh màu
    std_r = np.std(pixels[:, 0])
    std_g = np.std(pixels[:, 1])
    std_b = np.std(pixels[:, 2])
    
    # Trung bình độ lệch chuẩn
    avg_std = (std_r + std_g + std_b) / 3.0
    
    # Chuẩn hóa (giả định std > 50 là rất đa dạng màu sắc)
    score = (avg_std / 50.0) * 100
    return min(100, max(0, float(score)))


def process_image(image_bytes: bytes):
    if not MODEL_LOADED:
        return None
        
    original_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    W, H = original_image.size
    
    # ----------------------------------
    # 1. SEGMENTATION PIPELINE (mit_b5_unet)
    # ----------------------------------
    # Convert PIL Image to numpy (RGB format)
    ori_img_np = np.array(original_image)
    
    # Image size specific to the new model
    img_size = 384
    transform = A.Compose([
        A.Resize(img_size, img_size),
        A.Normalize(),
        ToTensorV2()
    ])
    
    input_tensor = transform(image=ori_img_np)['image'].unsqueeze(0).to(device)
    
    with torch.no_grad():
        output = model_seg(input_tensor)
        mask_pred = torch.sigmoid(output).cpu().numpy()[0][0]
        
    # Resize mask back to original image size
    mask_full = cv2.resize(mask_pred, (W, H))
    binary_mask = (mask_full > 0.5).astype(np.uint8)
    
    # Auto-Crop Logic
    coords = np.column_stack(np.where(binary_mask > 0))
    padding = 0.2
    
    if coords.size > 0:
        y_min, x_min = coords.min(axis=0)
        y_max, x_max = coords.max(axis=0)
        
        h_m, w_m = y_max - y_min, x_max - x_min
        rmin = max(0, int(y_min - h_m * padding))
        rmax = min(H, int(y_max + h_m * padding))
        cmin = max(0, int(x_min - w_m * padding))
        cmax = min(W, int(x_max + w_m * padding))
    else:
        rmin, rmax, cmin, cmax = 0, H, 0, W
        
    # Crop Image (PIL)
    cropped_image = original_image.crop((cmin, rmin, cmax, rmax))
    
    # Calculate bounding box for Frontend (values from 0 to 1 relative to original image)
    bbox = {
        "x": cmin / W,
        "y": rmin / H,
        "w": (cmax - cmin) / W,
        "h": (rmax - rmin) / H
    }
    
    # Calculate ABCDE features from segmentation
    a_score = calculate_asymmetry(binary_mask)
    b_score = calculate_border(binary_mask)
    c_score = calculate_color(ori_img_np, binary_mask)
    # D (Diameter): relative to image size, simplified
    d_score = min(100, ((cmax - cmin) * (rmax - rmin) / (W * H)) * 500) 
    
    abcde_results = {
        "A": a_score,
        "B": b_score,
        "C": c_score,
        "D": d_score,
        "E": 15.0 # Placeholder for single scan
    }
    
    # ----------------------------------
    # 2. DIAGNOSIS PIPELINE - WEIGHTED ENSEMBLE 2 MODEL + TTA x6 (On Cropped)
    #    Kỹ thuật: Weighted Average Probabilities + AMP fp16
    # ----------------------------------
    
    # 6 TTA augmentations (giữ nguyên tâm ảnh, không crop)
    tta_augments = [
        lambda img: img,                                          # 1. Original
        lambda img: img.transpose(Image.FLIP_LEFT_RIGHT),         # 2. Horizontal flip
        lambda img: img.transpose(Image.FLIP_TOP_BOTTOM),         # 3. Vertical flip
        lambda img: img.transpose(Image.ROTATE_90),               # 4. Rotate 90°
        lambda img: img.transpose(Image.ROTATE_270),              # 5. Rotate -90° (270°)
        lambda img: img.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.FLIP_TOP_BOTTOM),  # 6. HFlip+VFlip (≡ Rotate 180°)
    ]
    
    diag_transform_224 = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    
    with torch.no_grad():
        # Tách riêng predictions cho từng model để áp trọng số
        probs_list_a = []  # Lưu predictions Model A qua các TTA
        probs_list_b = []  # Lưu predictions Model B qua các TTA
        
        for tta_fn in tta_augments:
            aug_image = tta_fn(cropped_image)
            tensor_224 = diag_transform_224(aug_image).unsqueeze(0).to(device)
            
            # === Mixed Precision (AMP fp16) cho tốc độ và tiết kiệm VRAM ===
            with torch.amp.autocast(device_type=device_type):
                # Model A: EnsembleModel (8 classes)
                if model_a is not None:
                    outputs_a = model_a(tensor_224)
                    probs_a = torch.nn.functional.softmax(outputs_a[0], dim=0)
                    # Pad từ 8 -> 9 classes (thêm 0 cho class cuối)
                    probs_a = torch.cat([probs_a, torch.zeros(NUM_ENSEMBLE_CLASSES - 8, device=probs_a.device)])
                    probs_list_a.append(probs_a)
                
                # Model B: ConvNeXtV2-Tiny (9 classes) 
                if model_b is not None:
                    outputs_b = model_b(tensor_224)
                    probs_b = torch.nn.functional.softmax(outputs_b[0], dim=0)
                    probs_list_b.append(probs_b)
        
        # Trung bình TTA cho từng model
        if probs_list_a:
            avg_probs_a = torch.stack(probs_list_a).mean(dim=0)  # [9]
        else:
            avg_probs_a = None
            
        if probs_list_b:
            avg_probs_b = torch.stack(probs_list_b).mean(dim=0)  # [9]
        else:
            avg_probs_b = None
        
        # === Weighted Average Ensemble ===
        if avg_probs_a is not None and avg_probs_b is not None:
            # Cả 2 model đều sẵn sàng -> Weighted Average
            final_probs = (avg_probs_a * W_A) + (avg_probs_b * W_B)
        elif avg_probs_a is not None:
            final_probs = avg_probs_a
        elif avg_probs_b is not None:
            final_probs = avg_probs_b
        else:
            # Fallback: không model nào load được
            return None
        
        confidence, predicted = torch.max(final_probs, 0)
        
        # Calculate Top 3 predictions
        top3_prob, top3_indices = torch.topk(final_probs, 3)
        top3 = []
        for i in range(3):
            idx = top3_indices[i].item()
            label_name = LABELS[idx] if idx < len(LABELS) else "Unknown"
            score = round(float(top3_prob[i].item()) * 100, 2)
            top3.append({"label": label_name, "score": score})
        
    return int(predicted.item()), float(confidence.item()), bbox, top3, abcde_results


def get_current_user(authorization: str = Form(None)):
    """Helper to verify Firebase token from Form data or Header."""
    if not authorization:
        return None
    
    token = authorization.replace("Bearer ", "")
    user = firebase_auth_manager.verify_id_token(token)
    return user

@app.on_event("startup")
def startup_event():
    # Run once initially in background
    threading.Thread(target=run_explore_workflow, daemon=True).start()
    
    # Schedule to run every 1 hour
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_explore_workflow, 'interval', hours=1)
    scheduler.start()
    print("[Scheduler] LangGraph Explore Agent started.")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "SkinGuardAI API is running"}

@app.get("/api/explore")
async def get_explore_content(language: str = "vi"):
    """Fetch cached LangGraph blog posts."""
    blogs = get_latest_blogs()
    if not blogs:
        # Fallback if somehow empty or still loading
        blogs = [
            { "category": "Khởi tạo", "title": "Hệ thống đang phân tích xu hướng", "desc": "Các bài viết mới đang được AI tổng hợp bằng LangGraph. Vui lòng tải lại trang sau ít phút.", "img": "https://images.unsplash.com/photo-1551076805-e1869033e561" }
        ]
    return {"status": "success", "data": blogs}

@app.post("/api/history")
async def get_user_history(authorization: str = Form(...)):
    user = get_current_user(authorization)
    if not user:
        return {"status": "error", "message": "Unauthorized"}, 401
    
    user_id = user['uid']
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row # Để lấy dữ liệu dạng Dictionary
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM analysis_records WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        
        # Chuyển đổi dữ liệu từ SQLite sang định dạng JSON mà Frontend mong đợi
        data = []
        for row in rows:
            item = dict(row)
            item['abcde'] = json.loads(item['abcde']) if item['abcde'] else None
            item['top3'] = json.loads(item['top3']) if item['top3'] else None
            data.append(item)
            
        conn.close()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

class AnalyzeResponse(BaseModel):
    risk_score: float
    classification: str
    confidence: float
    abcde: dict
    bbox: dict
    top3: list

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_image(
    file: UploadFile = File(...), 
    authorization: str = Form(None),
    uv_index: float = Form(None),
    temperature: float = Form(None),
    location: str = Form(None)
):
    contents = await file.read()
    
    # Run Pipeline
    result = process_image(contents)
    
    if result:
        class_idx, confidence, bbox, top3, abcde_scores = result
        classification = LABELS[class_idx] if class_idx < len(LABELS) else "Unknown"
        
        if "MEL" in classification or "BCC" in classification or "SCC" in classification:
            base_risk = round(confidence * 100, 1)
        else:
            base_risk = round((1.0 - confidence) * 100, 1)
            
        # Real ABCDE logic from calculation
        abcde_final = {
            "A_score": abcde_scores["A"],
            "B_score": abcde_scores["B"],
            "C_score": abcde_scores["C"],
            "D_score": abcde_scores["D"],
            "E_score": abcde_scores["E"]
        }
    else:
        # Fallback if processing failed
        return {"status": "error", "message": "Model processing failed"}, 500


    # --- Save to LOCAL (SQLite + Local Storage) if User is Auth ---
    user = get_current_user(authorization)
    if user:
        try:
            user_id = user['uid']
            # Tạo tên file duy nhất
            ext = os.path.splitext(file.filename)[1]
            local_filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
            file_save_path = os.path.join(STORAGE_PATH, local_filename)
            
            # Lưu file ảnh xuống ổ D:/
            with open(file_save_path, "wb") as f:
                f.write(contents)
            
            # URL để frontend truy cập (thay thế link Supabase)
            # Giả sử server chạy ở port 8080
            image_url = f"http://localhost:8080/storage/{local_filename}"

            # Lưu vào SQLite
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO analysis_records 
                (id, user_id, image_url, risk_score, classification, confidence, abcde, top3, uv_index, temperature, location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()),
                user_id,
                image_url,
                base_risk,
                classification,
                round(confidence * 100 if result else confidence, 2),
                json.dumps(abcde_final),
                json.dumps(top3),
                uv_index,
                temperature,
                location
            ))
            conn.commit()
            conn.close()
            print(f"[OK] Scan saved LOCALLY (D:/.db & D:/skinderm_storage)")
        except Exception as e:
            print(f"[ERROR] Failed to save locally: {e}")
    
    # --- Generate Medical Advice using AI ---
    advice_prompt = (
        f"Phân tích kết quả scan da: Chẩn đoán là {classification} với độ tin cậy {confidence*100:.1f}%. "
        f"Mức độ rủi ro tổng thể: {base_risk}%. "
        "Hãy đưa ra lời khuyên y khoa ngắn gọn (2-3 câu), chuyên nghiệp nhưng dễ hiểu cho bệnh nhân. "
        "Nhấn mạnh vào việc theo dõi hoặc đi khám nếu cần thiết. Trả lời bằng tiếng Việt."
    )
    
    medical_advice = "Hệ thống đang chuẩn bị lời khuyên..."
    try:
        advice_res = nv_client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[{"role": "user", "content": advice_prompt}],
            max_tokens=256,
            temperature=0.3,
            stream=False
        )
        medical_advice = advice_res.choices[0].message.content.strip()
    except Exception as e:
        print(f"[WARN] Failed to generate AI advice: {e}")
        medical_advice = "Cảnh báo: AI phát hiện dấu hiệu bất thường. Hãy đặt lịch hẹn với bác sĩ da liễu để kiểm tra chi tiết." if base_risk > 50 else "Kết quả cho thấy nguy cơ thấp. Hãy tiếp tục theo dõi định kỳ."

    return {
        "risk_score": base_risk,
        "classification": classification,
        "confidence": round(confidence * 100 if result else confidence, 2),
        "medical_advice": medical_advice,
        "abcde": {
            "A_asymmetry": {
                "score": abcde_final["A_score"],
                "status": "High" if abcde_final["A_score"] > 50 else "Low"
            },
            "B_border": {
                "score": abcde_final["B_score"],
                "status": "Abnormal" if abcde_final["B_score"] > 50 else "Normal"
            },
            "C_color": {
                "score": abcde_final["C_score"],
                "status": "Moderate" if abcde_final["C_score"] > 50 else "Uniform"
            },
            "D_diameter": {
                "value": round(random.uniform(3.0, 9.5), 1),
                "score": abcde_final["D_score"]
            },
            "E_evolution": {
                "score": abcde_final["E_score"],
                "status": "Requires History"
            }
        },
        "bbox": bbox,
        "top3": top3
    }


@app.post("/api/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), authorization: str = Form(None)):
    """Upload user avatar to local storage."""
    user = get_current_user(authorization)
    if not user:
        return {"status": "error", "message": "Unauthorized"}, 401
    
    try:
        contents = await file.read()
        # Create a clean filename
        ext = os.path.splitext(file.filename)[1]
        if not ext: ext = ".jpg"
        
        filename = f"avatar_{user['uid']}{ext}"
        file_save_path = os.path.join(STORAGE_PATH, filename)
        
        with open(file_save_path, "wb") as f:
            f.write(contents)
        
        image_url = f"http://localhost:8080/storage/{filename}"
        return {"status": "success", "url": image_url}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500


class ChatRequest(BaseModel):
    message: str
    language: str = "vi"
    model: str = "moonshotai/kimi-k2.5"
    context: str = ""

@app.post("/api/chat")
async def chat_interaction(chat_req: ChatRequest, request: Request):
    system_prompt = (
        "Bạn là Bác sĩ Trưởng khoa Chuyên ngành Da liễu (DermAI Vision). "
        "Hãy trả lời bằng tiếng Việt, phong cách chuyên nghiệp, tận tâm. "
        "Dựa trên dữ liệu chẩn đoán sau: " + chat_req.context
    )

    async def generate_events():
        try:
            completion = nv_client.chat.completions.create(
                model=chat_req.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": chat_req.message}
                ],
                temperature=0.4,
                top_p=0.9,
                max_tokens=4096, # Set to reasonable limit
                stream=True,
                timeout=180.0
            )

            for chunk in completion:
                # Check if client is still there
                if await request.is_disconnected():
                    print("[INFO] Client disconnected. Stopping generation.")
                    break

                try:
                    if not getattr(chunk, "choices", None): continue
                    content = chunk.choices[0].delta.content
                    if content:
                        data = {"choices": [{"delta": {"content": content}}]}
                        yield f"data: {json.dumps(data)}\n\n"
                except Exception:
                    break

            yield "data: [DONE]\n\n"

        except Exception as e:
            print(f"Streaming Error: {e}")
            yield f'data: {{"error": "{str(e)}"}}\n\n'

    return StreamingResponse(generate_events(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
