# Skinderm AI - Skin Cancer Diagnosis (SkinGuard AI)

An AI-powered application for skin cancer diagnosis through deep learning image analysis, medical segmentation, and an AI Doctor chat support system.

## 📂 Project Structure

- `frontend/`: The static web interface (HTML, CSS, JS, Assets).
- `backend/`: The FastAPI backend, serving AI inference, chat, and Supabase/Firebase integrations.
- `scripts/`: Utility scripts for model inspection and testing.
- `docs/`: Project documentation and model parameters.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory and configure the following variables:
```env
NVIDIA_API_KEY=your_nvidia_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
FIREBASE_SERVICE_ACCOUNT_PATH=backend/your-firebase-adminsdk.json
```

### 2. Backend Installation & Execution

```bash
# Navigate to the backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
python main.py
```

### 3. Frontend Execution

You can open `frontend/index.html` directly in your browser or serve it using a local web server (e.g., Python's built-in `http.server`):
```bash
# From the root directory
cd frontend
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

## ✨ Features

- **AI Image Analysis**: Weighted ensemble models (EfficientNet + ConvNeXt) for mole/lesion classification across 9 classes.
- **Image Segmentation**: Precise U-Net based segmentation (mit_b5) with auto-cropping.
- **AI Doctor Chat**: Real-time chat with an AI dermatologist powered by advanced LLMs.
- **Real-time Insights**: Automatically updated dermatology news powered by LangGraph agents.
- **Scalable Architecture**: High-performance FastAPI server with Supabase database integration.
