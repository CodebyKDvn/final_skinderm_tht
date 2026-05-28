import os
import json
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from openai import OpenAI

# We use the existing NVIDIA client configuration to stay consistent.
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
nv_client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = NVIDIA_API_KEY,
  timeout = 90.0, # Increased for complex LangGraph chains
  max_retries = 1
)

# Global store for the latest blog posts
LATEST_BLOG_POSTS = []

class AgentState(TypedDict):
    topics: List[str]
    blogs: List[dict]
    language: str

def generate_topics(state: AgentState):
    """Generate current trending topics in dermatology using LLM."""
    print("[LangGraph Node] generate_topics started...")
    prompt = "You are a dermatology expert. Propose 3 trending topics in dermatology or skin care right now. Return ONLY a JSON list of 3 strings."
    
    try:
        response = nv_client.chat.completions.create(
            model="google/gemma-3-12b-it",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
            temperature=0.8
        )
        content = response.choices[0].message.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        topics = json.loads(content)
        if not isinstance(topics, list) or len(topics) == 0:
             topics = ["Phòng ngừa ung thư da", "Chăm sóc da mụn", "Lợi ích của Vitamin C"]
    except Exception as e:
        print(f"[LangGraph] Topic generation error: {e}")
        topics = ["Tác hại của tia UV", "Nhận biết sớm ung thư da", "Quy trình skincare cơ bản"]
        
    return {"topics": topics}

def write_blogs(state: AgentState):
    """Write blog posts based on the fetched topics."""
    print("[LangGraph Node] write_blogs started...")
    topics = state.get("topics", [])
    lang = state.get("language", "Vietnamese")
    
    prompt = (
        f"Write 3 high-quality dermatology blog posts based on these exactly 3 topics: {topics}. "
        "Each post must have: \n"
        "- 'category' (1-2 words)\n"
        "- 'title'\n"
        "- 'desc' (2 sentences max)\n"
        "- 'content' (Full detailed article in HTML, at least 3 paragraphs, using <h3>, <p>, <ul> to format. DO NOT use markdown code blocks like ```html inside the string. Just raw HTML string).\n"
        "- 'visual_description' (A detailed English description for a professional medical stock photo related to this topic. Focus on realistic clinical settings, dermatology equipment, or skin care products. DO NOT include any text in the image).\n"
        "Return ONLY a valid JSON array of exactly 3 objects. "
        f"The language must be {lang}."
    )

    try:
        response = nv_client.chat.completions.create(
            model="google/gemma-3-12b-it",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=3000,
            temperature=0.7
        )
        content = response.choices[0].message.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        blogs = json.loads(content)
        for blog in blogs:
            # Use a high-quality prompt for Pollinations or a search-like approach
            desc = blog.get('visual_description', 'professional dermatology medical photography')
            # Enhance prompt for realism
            enhanced_prompt = f"Professional medical stock photo of {desc}, high resolution, realistic, clinical lighting, 8k"
            encoded_prompt = enhanced_prompt.replace(' ', '%20')
            # Using a random seed to ensure different images for different topics
            import random
            seed = random.randint(1, 1000000)
            blog['img'] = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=800&height=600&nologo=true&seed={seed}"
    except Exception as e:
        print(f"[LangGraph] Blog writing error: {e}")
        # Fallback with realistic-ish prompts
        blogs = [
            { 
                "category": "Cập nhật", 
                "title": "Bảo vệ làn da của bạn", 
                "desc": "Những phương pháp bảo vệ da trước ánh nắng mặt trời.", 
                "content": "<h3>Tại sao phải bảo vệ da?</h3><p>Tia UV từ ánh nắng mặt trời là nguyên nhân chính gây ra lão hóa sớm và ung thư da. Việc sử dụng kem chống nắng hàng ngày giúp tạo lớp màng bảo vệ hiệu quả.</p><h3>Các bước cơ bản</h3><ul><li>Thoa kem chống nắng SPF 30+ trở lên.</li><li>Đeo kính râm và áo khoác khi ra ngoài.</li><li>Tránh ánh nắng trực tiếp từ 10h sáng đến 4h chiều.</li></ul>",
                "img": "https://images.unsplash.com/photo-1598440494830-ec069c97b69d?q=80&w=800" 
            },
            { 
                "category": "Kiến thức", 
                "title": "AI trong Y tế", 
                "desc": "Skinderm AI giúp phát hiện ung thư da sớm hơn.", 
                "content": "<h3>Trí tuệ nhân tạo (AI) hoạt động như thế nào?</h3><p>Công nghệ AI học hỏi từ hàng triệu hình ảnh y khoa để nhận diện các mô hình bất thường trên da. Tốc độ phân tích của AI chỉ mất vài giây với độ chính xác cao.</p><p>Skinderm AI sử dụng mô hình học sâu tiên tiến nhất, mang lại một phương pháp tầm soát nhanh chóng và tiện lợi ngay tại nhà.</p>",
                "img": "https://images.unsplash.com/photo-1576091160550-2173dad99901?q=80&w=800" 
            },
            { 
                "category": "Mẹo vặt", 
                "title": "Dưỡng ẩm đúng cách", 
                "desc": "Bí quyết dưỡng ẩm cho da mùa hanh khô hiệu quả.", 
                "content": "<h3>Tầm quan trọng của việc dưỡng ẩm</h3><p>Nước chiếm tỷ lệ lớn trong cấu trúc da. Khi thiếu nước, da sẽ trở nên khô, nứt nẻ và dễ bị tổn thương bởi các tác nhân bên ngoài.</p><h3>Bí quyết cho bạn</h3><ul><li>Uống đủ 2 lít nước mỗi ngày.</li><li>Sử dụng kem dưỡng ẩm phù hợp với loại da.</li><li>Không rửa mặt bằng nước quá nóng.</li></ul>",
                "img": "https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800" 
            }
        ]
        
    return {"blogs": blogs}

# --- Compile LangGraph Workflow ---
workflow = StateGraph(AgentState)
workflow.add_node("generate_topics", generate_topics)
workflow.add_node("write_blogs", write_blogs)

workflow.set_entry_point("generate_topics")
workflow.add_edge("generate_topics", "write_blogs")
workflow.add_edge("write_blogs", END)

explore_app = workflow.compile()

def run_explore_workflow():
    global LATEST_BLOG_POSTS
    print("[LangGraph] Starting scheduled blog generation...")
    try:
        final_state = explore_app.invoke({"topics": [], "blogs": [], "language": "Vietnamese"})
        if final_state and "blogs" in final_state:
            LATEST_BLOG_POSTS = final_state["blogs"]
            print(f"[LangGraph] Generated {len(LATEST_BLOG_POSTS)} new blog posts successfully.")
    except Exception as e:
        print(f"[LangGraph] Workflow failed: {e}")

def get_latest_blogs():
    return LATEST_BLOG_POSTS