import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.config import settings
from app.auth_dependencies import get_current_user, verify_media_access, get_auth_service
from app.services.auth_service import AuthService
from app.schemas.auth import MediaTicketResponse

router = APIRouter(prefix="/media", tags=["media"])

@router.post("/ticket", response_model=MediaTicketResponse)
async def create_media_ticket(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Generate an ephemeral, single-purpose 60-second media ticket.
    Permits authorized streaming or previewing of media where custom HTTP headers cannot be supplied.
    """
    ticket = auth_service.create_media_ticket(
        user_id=current_user["user_id"],
        email=current_user.get("email", "")
    )
    return MediaTicketResponse(ticket=ticket, expires_in_seconds=60)

def serve_media_file(file_path: str) -> FileResponse:
    """
    Safely resolve target media file within upload_absolute_dir.
    Guards against path traversal attacks.
    """
    base_upload_dir = settings.upload_absolute_dir.resolve()
    target_path = (base_upload_dir / file_path).resolve()

    # Prevent directory traversal attacks
    if not str(target_path).startswith(str(base_upload_dir)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Path traversal detected."
        )

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested media asset not found."
        )

    # Determine media type safely
    suffix = target_path.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska"
    }
    content_type = media_types.get(suffix, "application/octet-stream")

    return FileResponse(
        path=str(target_path),
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"}
    )

@router.get("/{file_path:path}")
async def get_protected_media(
    file_path: str,
    current_user: dict = Depends(verify_media_access)
):
    """
    Securely serve uploaded inspection media (images, video previews).
    Requires authenticated user via Bearer token header or short-lived ?ticket= parameter.
    Guards against path traversal attacks.
    """
    return serve_media_file(file_path)
