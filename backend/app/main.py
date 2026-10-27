import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.utils.image_utils import ensure_upload_directories
from app.services.detection_service import DetectionService
from app.routes import detection, camera, maintenance, analytics, alerts, hospital, reports, auth, media
from app.auth_dependencies import require_authenticated

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("smartroadai.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycles."""
    logger.info("Initializing SmartRoadAI Backend Services...")
    
    # 1. Establish MongoDB connection and seed database
    await connect_to_mongo()
    
    # 2. Ensure local storage folders exist
    ensure_upload_directories()
    
    # 3. Cache YOLO model during startup
    try:
        DetectionService.load_model()
    except Exception as e:
        logger.error(f"YOLO model failed to initialize during startup: {e}. Lazy loading will be triggered.")

    # 4. Security checks for production environment
    if settings.is_production:
        if settings.JWT_SECRET_KEY == "512761d6bbf0083bf6b20927f1170946e572bf4013f336ddfe94e6dc35afc578":
            logger.critical("SECURITY WARNING: Production mode active with default development JWT_SECRET_KEY! Generate and set a unique key in .env.")
        logger.info("Running in PRODUCTION mode. Public interactive API documentation (/docs, /redoc) is disabled.")

    yield
    
    # 5. Clean shutdown
    await close_mongo_connection()
    logger.info("SmartRoadAI Backend shut down successfully.")

# Initialize FastAPI app
app = FastAPI(
    title="SmartRoadAI Backend",
    description="Production-grade AI API for smart road damage monitoring and maintenance logging.",
    version="1.0.0",
    docs_url=None if settings.is_production and not settings.DEBUG else "/docs",
    redoc_url=None if settings.is_production and not settings.DEBUG else "/redoc",
    openapi_url=None if settings.is_production and not settings.DEBUG else "/openapi.json",
    lifespan=lifespan
)

# Enable Cross-Origin Resource Sharing (CORS) with explicitly permitted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload storage folder exists
settings.upload_absolute_dir.mkdir(parents=True, exist_ok=True)

# Secure media endpoint for direct /uploads/... requests (prevents unauthenticated leaks)
@app.get("/uploads/{file_path:path}", tags=["media"])
async def get_protected_uploads(
    file_path: str,
    current_user: dict = Depends(media.verify_media_access)
):
    """
    Securely serve uploaded media assets requested via /uploads/...
    Enforces authentication and path traversal protection. Unauthenticated requests are rejected with 401.
    """
    return media.serve_media_file(file_path)

# Define master API router
api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth.router)
api_v1_router.include_router(media.router)
api_v1_router.include_router(detection.router)
api_v1_router.include_router(camera.router)
api_v1_router.include_router(maintenance.router)
api_v1_router.include_router(analytics.router)
api_v1_router.include_router(alerts.router)
api_v1_router.include_router(hospital.router)
api_v1_router.include_router(reports.router)

# Mount all endpoints
from app.dependencies import get_db

@api_v1_router.get("/detections", tags=["detection"])
async def get_all_detections_alias(
    response: Response = None,
    limit: int = 50,
    skip: int = 0,
    db=Depends(get_db),
    current_user: dict = Depends(require_authenticated)
):
    """Retrieve list of all historical image and video detection results (alias)."""
    from starlette.responses import Response as StarletteResponse
    if response is None:
        response = StarletteResponse()
    return await detection.get_all_detections(response, limit, skip, db, current_user)

app.include_router(api_v1_router)

@app.get("/health", tags=["health"])
def health_check():
    """Simple connection health validation endpoint."""
    return {"status": "online", "model_cached": DetectionService._model is not None}
