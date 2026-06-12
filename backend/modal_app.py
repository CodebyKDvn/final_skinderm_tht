import modal
import os

# Create the Modal App
app = modal.App("skinderm-backend")

# Define the container image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    # Install system dependencies for OpenCV and other packages
    .apt_install("libgl1", "libglib2.0-0")
    # Set working directory to /root where the code resides
    .workdir("/root")
    # Install Python packages
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.2",
        "torch",
        "torchvision",
        "timm",
        "segmentation-models-pytorch",
        "albumentations",
        "opencv-python-headless",
        "matplotlib",
        "firebase-admin",
        "supabase",
        "python-dotenv",
        "openai",
        "apscheduler",
        "langgraph",
        "langchain",
        "requests",
        "pillow"
    )
    # Add local directory contents to /root at container startup
    .add_local_dir(
        ".",
        remote_path="/root",
        ignore=["**/__pycache__", "**/.env", "**/skinderm.db", "**/skinderm_storage"]
    )
)

# Define a persistent volume for the database and storage files
# We mount this at /data.
volume = modal.Volume.from_name("skinderm-storage", create_if_missing=True)

@app.function(
    image=image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_dotenv()],
    timeout=600,
)
@modal.asgi_app()
def fastapi_app():
    # Set STORAGE_ROOT to point to the persistent volume mount path
    os.environ["STORAGE_ROOT"] = "/data"
    
    # Import the FastAPI app inside the function context
    from main import app as web_app
    return web_app
