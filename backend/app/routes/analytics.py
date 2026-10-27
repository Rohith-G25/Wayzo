from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_analytics_service
from app.auth_dependencies import require_authenticated
from app.services.analytics_service import AnalyticsService
from app.schemas.analytics import SystemStatisticsResponse

router = APIRouter(tags=["statistics"])

@router.get("/statistics", response_model=SystemStatisticsResponse)
async def get_system_statistics_endpoint(
    service: AnalyticsService = Depends(get_analytics_service),
    current_user: dict = Depends(require_authenticated)
):
    """
    Retrieve real-time consolidated system metrics (severities, pending tickets, etc.)
    for the master management dashboard.
    """
    try:
        stats = await service.get_system_statistics()
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile system statistics: {str(e)}"
        )
