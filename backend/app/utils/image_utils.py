import os
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile
from app.config import settings, BASE_DIR

def ensure_upload_directories():
    """Ensure that all required upload directories exist."""
    base_upload = settings.upload_absolute_dir
    os.makedirs(base_upload / "images", exist_ok=True)
    os.makedirs(base_upload / "videos", exist_ok=True)
    os.makedirs(base_upload / "processed", exist_ok=True)

def save_uploaded_file(upload_file: UploadFile, subfolder: str) -> Path:
    """
    Save an uploaded file to the specified subfolder under the upload directory.
    Returns the absolute path of the saved file.
    """
    ensure_upload_directories()
    
    # Generate unique filename to avoid overwrites
    filename = upload_file.filename or "upload.jpg"
    extension = Path(filename).suffix.lower()
    if not extension:
        extension = ".jpg"
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    
    target_dir = settings.upload_absolute_dir / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / unique_filename
    
    upload_file.file.seek(0)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
        
    return file_path

def get_relative_upload_path(absolute_path: Path) -> str:
    """
    Convert an absolute file path into a relative URL path (e.g. 'uploads/images/abc.jpg').
    Handles paths relative to BASE_DIR or settings.upload_absolute_dir.
    """
    path_obj = Path(absolute_path).resolve()
    base_dir = Path(getattr(settings, "BASE_DIR", BASE_DIR)).resolve()
    upload_dir = Path(settings.upload_absolute_dir).resolve()

    try:
        rel_to_base = path_obj.relative_to(base_dir)
        return str(rel_to_base).replace("\\", "/")
    except ValueError:
        pass

    try:
        rel_to_upload = path_obj.relative_to(upload_dir)
        return f"uploads/{rel_to_upload}".replace("\\", "/")
    except ValueError:
        pass

    return f"uploads/{path_obj.parent.name}/{path_obj.name}".replace("\\", "/")

def validate_image_file(file_path: Path) -> bool:
    """
    Validate that the file exists, is non-empty, and can be read by OpenCV.
    """
    if not file_path.exists() or file_path.stat().st_size == 0:
        return False
    import cv2
    img = cv2.imread(str(file_path))
    return img is not None and img.size > 0

