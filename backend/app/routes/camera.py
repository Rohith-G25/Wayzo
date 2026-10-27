from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from app.dependencies import get_db
from app.auth_dependencies import require_authenticated
from app.schemas.analytics import CameraStatusResponse

router = APIRouter(prefix="/cameras", tags=["camera"])

@router.get("", response_model=List[CameraStatusResponse])
async def get_cameras(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_authenticated)
):
    """Retrieve lists of connected cameras, location info, and online status."""
    cursor = db.cameras.find()
    cameras = await cursor.to_list(length=100)
    return cameras
