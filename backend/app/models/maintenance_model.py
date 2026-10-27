from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class GPSModel(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = "manual"

class MaintenanceDocument(BaseModel):
    work_order_id: str
    ticket_id: str  # alias for backward-compatibility
    priority: str  # "Low", "Medium", "High", "Critical"
    road_name: str
    description: str
    gps: Optional[GPSModel] = None
    gps_source: Optional[str] = None
    estimated_cost: str
    actual_cost: Optional[str] = None
    status: str = "Open"  # "Open", "Assigned", "In Progress", "Completed", "Cancelled"
    inspection_id: Optional[str] = None
    detection_id: Optional[str] = None
    damage_category: Optional[str] = None
    defect_info: Optional[Dict[str, Any]] = None
    severity_estimate: Optional[str] = None
    assigned_team: Optional[str] = None
    image_url: Optional[str] = None
    target_completion_date: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    status_history: List[Dict[str, Any]] = Field(default_factory=list)
    completion_details: Optional[Dict[str, Any]] = None
    severity_disclaimer: Optional[str] = None
    cost_disclaimer: Optional[str] = None

    class Config:
        populate_by_name = True
