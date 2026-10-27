from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List, Optional
from app.dependencies import get_hospital_service
from app.auth_dependencies import require_authenticated
from app.services.hospital_service import HospitalService
from app.schemas.analytics import HospitalResponse

router = APIRouter(prefix="/hospitals", tags=["hospital"])

@router.get("", response_model=List[HospitalResponse])
async def get_nearby_hospitals_endpoint(
    latitude: Optional[float] = Query(None, description="GPS Latitude coordinate of incident"),
    longitude: Optional[float] = Query(None, description="GPS Longitude coordinate of incident"),
    service: HospitalService = Depends(get_hospital_service),
    current_user: dict = Depends(require_authenticated)
):
    """
    Search for closest hospitals and dispatch emergency ambulances 
    based on GPS coordinates of the incident.
    """
    # Use default coordinates (Delhi Center) if not specified
    lat = latitude if latitude is not None else 28.6139
    lon = longitude if longitude is not None else 77.2090
    
    try:
        hospitals = await service.get_nearby_hospitals(lat, lon)
        return hospitals
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query emergency dispatch centers: {str(e)}"
        )
