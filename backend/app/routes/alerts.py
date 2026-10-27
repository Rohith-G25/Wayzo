from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from app.dependencies import get_db
from app.auth_dependencies import require_authenticated
from app.schemas.analytics import AlertResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[AlertResponse])
async def get_live_alerts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_authenticated)
):
    """Retrieve lists of active hazardous alerts across the city grid."""
    cursor = db.alerts.find().sort("timestamp", -1)
    alerts = await cursor.to_list(length=100)
    return alerts
