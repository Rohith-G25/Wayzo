from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class GPSCoordinate(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = "manual"  # "exif", "manual", "telemetry"

class StatusHistoryItem(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    changed_at: str
    notes: Optional[str] = None
    changed_by: Optional[str] = None

class CompletionDetails(BaseModel):
    completed_at: Optional[str] = None
    completion_notes: Optional[str] = None
    actual_cost: Optional[str] = None
    contractor_name: Optional[str] = None

class WorkOrderCreate(BaseModel):
    inspection_id: Optional[str] = Field(None, description="Linked detection/inspection ID (e.g. DET-XXXX)")
    road_name: Optional[str] = Field("Unspecified Road", description="Name of the affected road or corridor")
    description: Optional[str] = Field(None, description="Description of the repair work required")
    priority: str = Field("Medium", description="Priority level: Low, Medium, High, Critical")
    damage_category: Optional[str] = Field(None, description="Primary damage category (e.g. Pothole, Longitudinal Crack)")
    defect_info: Optional[Dict[str, Any]] = Field(None, description="Specific defect details (bounding box, confidence)")
    estimated_cost: Optional[str] = Field(None, description="Estimated repair cost, e.g. ₹15,000")
    assigned_team: Optional[str] = Field(None, description="Assigned maintenance team or responsible crew")
    target_completion_date: Optional[str] = Field(None, description="Target completion date (YYYY-MM-DD)")
    latitude: Optional[float] = Field(None, description="GPS Latitude coordinate (validated)")
    longitude: Optional[float] = Field(None, description="GPS Longitude coordinate (validated)")
    initial_notes: Optional[str] = Field(None, description="Initial triage notes")
    status: Optional[str] = Field("Open", description="Initial status of the work order")

# Backward-compatible alias for existing code
MaintenanceCreate = WorkOrderCreate

class WorkOrderStatusUpdate(BaseModel):
    status: str = Field(..., description="New status: Open, Assigned, In Progress, Completed, Cancelled")
    notes: Optional[str] = Field(None, description="Reason or operational notes for the status change")
    actual_cost: Optional[str] = Field(None, description="Actual cost incurred upon completion (e.g. ₹14,200)")
    completion_notes: Optional[str] = Field(None, description="Summary of work completed by the repair crew")

class WorkOrderUpdate(BaseModel):
    priority: Optional[str] = Field(None, description="Updated priority: Low, Medium, High, Critical")
    assigned_team: Optional[str] = Field(None, description="Updated maintenance team")
    description: Optional[str] = Field(None, description="Updated description")
    target_completion_date: Optional[str] = Field(None, description="Updated target completion date")
    road_name: Optional[str] = Field(None, description="Updated road name")
    notes: Optional[str] = Field(None, description="Update notes")

class WorkOrderResponse(BaseModel):
    work_order_id: str
    ticket_id: str  # alias for backward-compatibility with existing code
    inspection_id: Optional[str] = None
    detection_id: Optional[str] = None  # alias
    road_name: str
    description: str
    priority: str  # "Low", "Medium", "High", "Critical"
    status: str  # "Open", "Assigned", "In Progress", "Completed", "Cancelled"
    damage_category: Optional[str] = None
    defect_info: Optional[Dict[str, Any]] = None
    severity_estimate: Optional[str] = None
    estimated_cost: str
    actual_cost: Optional[str] = None
    assigned_team: Optional[str] = None
    gps: Optional[GPSCoordinate] = None
    gps_source: Optional[str] = None
    image_url: Optional[str] = None
    target_completion_date: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    status_history: List[StatusHistoryItem] = Field(default_factory=list)
    completion_details: Optional[CompletionDetails] = None
    severity_disclaimer: str = (
        "Heuristic calculation based on bounding-box surface area and model confidence; "
        "not a certified civil/pavement engineering assessment."
    )
    cost_disclaimer: str = (
        "Automated cost estimate based on detected damage geometry; subject to field contractor assessment."
    )

    class Config:
        populate_by_name = True

# Backward-compatible alias
MaintenanceResponse = WorkOrderResponse

class MaintenanceStatisticsResponse(BaseModel):
    total_work_orders: int
    open_work_orders: int
    assigned_work_orders: int
    in_progress_work_orders: int
    completed_work_orders: int
    cancelled_work_orders: int
    high_priority_unresolved: int
    total_estimated_cost_val: float
    formatted_total_estimated_cost: str
    status_distribution: Dict[str, int]
    priority_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    team_distribution: Dict[str, int]
