from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class GPSModel(BaseModel):
    latitude: float
    longitude: float

class DetectionItemModel(BaseModel):
    class_name: str = Field(alias="class")
    confidence: float
    severity: str
    bounding_box: List[float]
    estimated_cost: str

    class Config:
        populate_by_name = True

class DetectionDocument(BaseModel):
    detection_id: str
    filename: str
    gps: GPSModel
    timestamp: datetime
    detections: List[DetectionItemModel]
    processing_time: str
    success: bool = True

    class Config:
        populate_by_name = True
