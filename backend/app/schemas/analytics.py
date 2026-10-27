from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.maintenance import GPSCoordinate

from typing import List, Optional, Dict, Any

class SystemStatisticsResponse(BaseModel):
    # Backward-compatible master counters
    total_detections: int = Field(..., alias="totalDetections")
    high_severity: int = Field(..., alias="highSeverity")
    medium_severity: int = Field(..., alias="mediumSeverity")
    low_severity: int = Field(..., alias="lowSeverity")
    repairs_pending: int = Field(..., alias="repairsPending")
    repairs_completed: int = Field(..., alias="repairsCompleted")
    camera_count: int = Field(..., alias="cameraCount")
    system_health: str = Field(..., alias="systemHealth")

    # Real inspection & defect counts
    total_inspections: int = Field(default=0, alias="totalInspections")
    total_defects: int = Field(default=0, alias="totalDefects")
    pothole_count: int = Field(default=0, alias="potholeCount")
    crack_count: int = Field(default=0, alias="crackCount")
    critical_count: int = Field(default=0, alias="criticalCount")

    # Real category, severity, and temporal distributions
    category_distribution: Dict[str, int] = Field(default_factory=dict, alias="categoryDistribution")
    severity_distribution: Dict[str, int] = Field(default_factory=dict, alias="severityDistribution")
    inspection_trends: List[Dict[str, Any]] = Field(default_factory=list, alias="inspectionTrends")

    class Config:
        populate_by_name = True

class CameraStatusResponse(BaseModel):
    camera_id: str
    location: str
    gps: GPSCoordinate
    status: str  # "Active", "Inactive", "Maintenance"
    last_ping: str

    class Config:
        populate_by_name = True

class AlertResponse(BaseModel):
    alert_id: str
    type: str  # "Critical Damage", "Traffic Congestion", etc.
    description: str
    location: str
    gps: GPSCoordinate
    severity: str  # "Low", "Medium", "High", "Critical"
    timestamp: str

    class Config:
        populate_by_name = True

class HospitalResponse(BaseModel):
    name: str = Field(..., alias="nearestHospital")
    distance: str  # e.g., "1.2 km"
    eta: str  # e.g., "5 mins"
    ambulance_status: str = Field(..., alias="ambulanceStatus")  # "Available", "Dispatched"
    contact: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        populate_by_name = True
