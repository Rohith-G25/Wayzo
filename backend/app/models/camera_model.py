from pydantic import BaseModel
from datetime import datetime
from app.models.detection_model import GPSModel

class CameraDocument(BaseModel):
    camera_id: str
    location: str
    gps: GPSModel
    status: str  # "Active", "Inactive", "Maintenance"
    last_ping: datetime

    class Config:
        populate_by_name = True
