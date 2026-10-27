from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_database
from app.services.detection_service import DetectionService
from app.services.maintenance_service import MaintenanceService
from app.services.analytics_service import AnalyticsService
from app.services.hospital_service import HospitalService

async def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency for accessing the database."""
    return get_database()

def get_detection_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> DetectionService:
    """Dependency injection for DetectionService."""
    return DetectionService(db)

def get_maintenance_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> MaintenanceService:
    """Dependency injection for MaintenanceService."""
    return MaintenanceService(db)

def get_analytics_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> AnalyticsService:
    """Dependency injection for AnalyticsService."""
    return AnalyticsService(db)

def get_hospital_service(db: AsyncIOMotorDatabase = Depends(get_db)) -> HospitalService:
    """Dependency injection for HospitalService."""
    return HospitalService(db)

def get_pdf_report_service(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Dependency injection for PDFReportService."""
    from app.services.pdf_report_service import PDFReportService
    return PDFReportService(db)
