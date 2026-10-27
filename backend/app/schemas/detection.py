from pydantic import BaseModel, Field, computed_field
from typing import List, Optional, Dict, Any
from datetime import datetime

class DetectionItem(BaseModel):
    category: str = Field(..., alias="class")
    confidence: float
    severity: str
    bounding_box: List[float]
    estimated_cost: str

    @computed_field(alias="class")
    @property
    def class_alias(self) -> str:
        return self.category

    @computed_field
    @property
    def class_name(self) -> str:
        return self.category

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "class": "pothole",
                "class_name": "pothole",
                "confidence": 0.96,
                "severity": "High",
                "bounding_box": [100.0, 150.0, 250.0, 300.0],
                "estimated_cost": "₹15000"
            }
        }
    }

class ImageDetectionResponse(BaseModel):
    success: bool
    filename: str
    image_url: Optional[str] = None
    processed_image_path: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps: Optional[Dict[str, Any]] = None
    gps_source: Optional[str] = None
    highest_severity: Optional[str] = None
    severity_score: Optional[float] = None
    estimated_cost: Optional[str] = None
    timestamp: Optional[str] = None
    detections: List[DetectionItem]
    processing_time: str
    model_name: Optional[str] = None
    severity_disclaimer: Optional[str] = None

    model_config = {
        "populate_by_name": True
    }

class FrameDetectionItem(BaseModel):
    frame_number: int
    timestamp_sec: float
    formatted_time: str
    defect_count: int
    highest_severity: str
    preview_image: Optional[str] = None
    detections: List[Dict[str, Any]] = Field(default_factory=list)

class VideoDetectionResponse(BaseModel):
    success: bool
    detection_id: Optional[str] = None
    media_type: str = "video"
    filename: Optional[str] = None
    processed_video_path: Optional[str] = None
    preview_image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps: Optional[Dict[str, Any]] = None
    gps_source: Optional[str] = None
    duration_seconds: Optional[float] = 0.0
    total_frames: int
    sampled_frames: Optional[int] = 0
    sample_interval_sec: Optional[float] = 1.0
    damages_detected: int
    highest_severity: str
    severity_score: Optional[float] = 0.0
    estimated_cost: Optional[str] = "₹0"
    category_counts: Optional[Dict[str, int]] = None
    frame_detections: Optional[List[FrameDetectionItem]] = Field(default_factory=list)
    detections: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    timestamp: Optional[str] = None
    processing_time: Optional[str] = None
    model_name: Optional[str] = "RDD2022-YOLOv8s"
    severity_disclaimer: Optional[str] = None

    model_config = {
        "populate_by_name": True
    }

class GeoInspectionItem(BaseModel):
    id: str
    detection_id: str
    media_type: str  # "image" | "video"
    latitude: float
    longitude: float
    gps_source: str  # "exif" | "manual" | "known"
    highest_severity: str
    severity_score: float
    estimated_cost: str
    defect_count: int
    category_counts: Dict[str, int]
    categories: List[str]
    timestamp: str
    image_url: Optional[str] = None
    preview_image_url: Optional[str] = None
    video_metadata: Optional[Dict[str, Any]] = None
    severity_disclaimer: Optional[str] = None
    work_order_id: Optional[str] = None
    work_order_status: Optional[str] = None

class UnlocatedInspectionItem(BaseModel):
    id: str
    detection_id: str
    media_type: str
    highest_severity: str
    severity_score: float
    defect_count: int
    category_counts: Dict[str, int]
    categories: List[str]
    timestamp: str
    image_url: Optional[str] = None
    preview_image_url: Optional[str] = None
    missing_reason: str = "No GPS coordinates provided or available in EXIF"
    work_order_id: Optional[str] = None
    work_order_status: Optional[str] = None

class GeoInspectionsResponse(BaseModel):
    located_inspections: List[GeoInspectionItem] = Field(default_factory=list)
    unlocated_inspections: List[UnlocatedInspectionItem] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)

class VideoJobStatusResponse(BaseModel):
    job_id: str
    status: str  # "queued", "processing", "completed", "failed"
    progress: int  # 0 to 100
    message: str
    processed_frames: Optional[int] = 0
    total_sampled_frames: Optional[int] = 0
    defects_found: Optional[int] = 0
    result: Optional[VideoDetectionResponse] = None
    error: Optional[str] = None

    model_config = {
        "populate_by_name": True
    }

FrameDetectionItem.model_rebuild()
VideoDetectionResponse.model_rebuild()
VideoJobStatusResponse.model_rebuild()
GeoInspectionItem.model_rebuild()
UnlocatedInspectionItem.model_rebuild()
GeoInspectionsResponse.model_rebuild()
