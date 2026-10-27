from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status, Response, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timezone
import os

from app.dependencies import get_db, get_detection_service
from app.auth_dependencies import require_inspector, require_authenticated
from app.services.detection_service import DetectionService
from app.schemas.detection import ImageDetectionResponse, VideoDetectionResponse
from app.utils.image_utils import save_uploaded_file

router = APIRouter(prefix="/detect", tags=["detection"])

@router.post("/image", response_model=ImageDetectionResponse)
async def detect_image_endpoint(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    service: DetectionService = Depends(get_detection_service),
    current_user: dict = Depends(require_inspector)
):
    """
    Upload an image of a road, detect damages (potholes/cracks), 
    and log the detection with geographic coordinates.
    """
    if not file.filename or not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Supported formats: png, jpg, jpeg, webp"
        )
        
    temp_path = None
    try:
        # Save file to uploads/images
        temp_path = save_uploaded_file(file, "images")
        
        # Process detection
        response = await service.detect_image(
            image_path=temp_path,
            latitude=latitude,
            longitude=longitude,
            timestamp=datetime.now(timezone.utc)
        )
        return response
    except ValueError as ve:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except FileNotFoundError as fe:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(fe)
        )
    except HTTPException:
        raise
    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image detection: {str(e)}"
        )

from fastapi import BackgroundTasks
from app.config import settings
from app.schemas.detection import (
    ImageDetectionResponse, 
    VideoDetectionResponse, 
    VideoJobStatusResponse,
    GeoInspectionsResponse,
    GeoInspectionItem,
    UnlocatedInspectionItem
)
from app.utils.gps import validate_coordinates
from app.services.video_job_service import video_job_manager

@router.post("/video", response_model=VideoDetectionResponse)
async def detect_video_endpoint(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    sample_interval_sec: Optional[float] = Form(None),
    service: DetectionService = Depends(get_detection_service),
    current_user: dict = Depends(require_inspector)
):
    """
    Upload a road recording video and process sampled frames using RDD2022-YOLOv8s model.
    Synchronously returns aggregated detection metrics and frame timestamps.
    """
    if not file.filename or not file.filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video format. Supported formats: mp4, avi, mov, mkv"
        )
        
    temp_path = None
    try:
        temp_path = save_uploaded_file(file, "videos")
        
        # Verify file size limit
        file_size_mb = temp_path.stat().st_size / (1024 * 1024)
        if file_size_mb > settings.MAX_VIDEO_UPLOAD_SIZE_MB:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Video file size ({file_size_mb:.1f} MB) exceeds maximum limit of {settings.MAX_VIDEO_UPLOAD_SIZE_MB} MB."
            )

        response = await service.detect_video(
            temp_path,
            sample_interval_sec=sample_interval_sec,
            latitude=latitude,
            longitude=longitude
        )
        return response
    except ValueError as e:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing video detection: {str(e)}"
        )

@router.post("/video/start", response_model=VideoJobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_video_job_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    sample_interval_sec: Optional[float] = Form(None),
    service: DetectionService = Depends(get_detection_service),
    current_user: dict = Depends(require_inspector)
):
    """
    Start an asynchronous background video inspection job.
    Returns immediately with a job_id for real-time progress polling.
    """
    if not file.filename or not file.filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video format. Supported formats: mp4, avi, mov, mkv"
        )

    temp_path = None
    try:
        temp_path = save_uploaded_file(file, "videos")
        file_size = temp_path.stat().st_size
        file_size_mb = file_size / (1024 * 1024)
        if file_size_mb > settings.MAX_VIDEO_UPLOAD_SIZE_MB:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Video file size ({file_size_mb:.1f} MB) exceeds maximum limit of {settings.MAX_VIDEO_UPLOAD_SIZE_MB} MB."
            )

        job_id = video_job_manager.create_job(file.filename, file_size)
        now_iso = datetime.now(timezone.utc).isoformat()
        if service.db is not None:
            await service.db.video_jobs.insert_one({
                "job_id": job_id,
                "filename": file.filename,
                "file_size_bytes": file_size,
                "status": "queued",
                "progress": 0,
                "message": "Video queued for RDD2022 inspection",
                "processed_frames": 0,
                "total_sampled_frames": 0,
                "defects_found": 0,
                "result": None,
                "error": None,
                "created_at": now_iso,
                "updated_at": now_iso
            })

        async def execute_video_analysis():
            def progress_callback(current: int, total: int, defects: int, msg: str):
                pct = int((current / total) * 100) if total > 0 else 0
                video_job_manager.update_job(
                    job_id,
                    progress=pct,
                    processed_frames=current,
                    total_sampled_frames=total,
                    defects_found=defects,
                    message=msg
                )

            try:
                video_job_manager.update_job(
                    job_id,
                    status="processing",
                    message="Initializing OpenCV video stream and RDD2022 neural pipeline..."
                )
                if service.db is not None:
                    await service.db.video_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {
                            "status": "processing",
                            "message": "Initializing OpenCV video stream and RDD2022 neural pipeline...",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )

                result = await service.detect_video(
                    temp_path,
                    progress_callback=progress_callback,
                    sample_interval_sec=sample_interval_sec,
                    latitude=latitude,
                    longitude=longitude
                )

                video_job_manager.update_job(
                    job_id,
                    status="completed",
                    progress=100,
                    message="Video road inspection completed successfully",
                    result=result
                )
                if service.db is not None:
                    await service.db.video_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {
                            "status": "completed",
                            "progress": 100,
                            "message": "Video road inspection completed successfully",
                            "result": result,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
            except Exception as ex:
                video_job_manager.update_job(
                    job_id,
                    status="failed",
                    error=str(ex),
                    message=f"Video analysis failed: {str(ex)}"
                )
                if service.db is not None:
                    await service.db.video_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {
                            "status": "failed",
                            "error": str(ex),
                            "message": f"Video analysis failed: {str(ex)}",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                if temp_path and temp_path.exists():
                    try:
                        temp_path.unlink()
                    except OSError:
                        pass

        background_tasks.add_task(execute_video_analysis)

        return VideoJobStatusResponse(
            job_id=job_id,
            status="queued",
            progress=0,
            message="Video queued for RDD2022 inspection",
            processed_frames=0,
            total_sampled_frames=0,
            defects_found=0
        )
    except HTTPException:
        raise
    except Exception as e:
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating video inspection: {str(e)}"
        )

@router.get("/video/status/{job_id}", response_model=VideoJobStatusResponse)
async def get_video_job_status_endpoint(
    job_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_inspector)
):
    """
    Poll the current status and real-time progress of a video inspection job.
    Recovers state from database if backend was restarted.
    """
    job = video_job_manager.get_job(job_id)
    if not job and db is not None:
        db_job = await db.video_jobs.find_one({"job_id": job_id})
        if db_job:
            job = db_job

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video inspection job {job_id} not found."
        )

    return VideoJobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job.get("progress", 0),
        message=job.get("message", ""),
        processed_frames=job.get("processed_frames", 0),
        total_sampled_frames=job.get("total_sampled_frames", 0),
        defects_found=job.get("defects_found", 0),
        result=job.get("result"),
        error=job.get("error")
    )

@router.get("/detections", response_model=List[dict])
async def get_all_detections(
    response: Response,
    limit: int = 50,
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_authenticated)
):
    """Retrieve paginated list of historical road detection results."""
    safe_limit = max(1, min(limit, 200))
    safe_skip = max(0, skip)
    
    total_count = await db.detections.count_documents({})
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(safe_limit)
    response.headers["X-Skip"] = str(safe_skip)

    cursor = db.detections.find().sort("timestamp", -1).skip(safe_skip).limit(safe_limit)
    results = await cursor.to_list(length=safe_limit)
    
    for res in results:
        res["id"] = str(res.pop("_id"))
        
    return results

@router.get("/history", response_model=dict)
async def get_paginated_history(
    limit: int = 20,
    skip: int = 0,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_authenticated)
):
    """Retrieve structured paginated envelope with inspection metadata."""
    safe_limit = max(1, min(limit, 100))
    safe_skip = max(0, skip)
    
    total_count = await db.detections.count_documents({})
    cursor = db.detections.find().sort("timestamp", -1).skip(safe_skip).limit(safe_limit)
    results = await cursor.to_list(length=safe_limit)
    
    for res in results:
        res["id"] = str(res.pop("_id"))

    return {
        "items": results,
        "total": total_count,
        "limit": safe_limit,
        "skip": safe_skip,
        "has_more": (safe_skip + len(results)) < total_count
    }

@router.get("/geo-inspections", response_model=GeoInspectionsResponse)
async def get_geo_inspections(
    media_type: Optional[str] = "all",
    severity: Optional[str] = "all",
    category: Optional[str] = "all",
    limit: int = 200,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: dict = Depends(require_authenticated)
):
    """
    Retrieve validated geographic inspection records for interactive GIS map plotting.
    Excludes records with invalid/missing GPS from map points and groups them into unlocated inspections.
    Sanitizes internal server paths to safe client-relative media URLs.
    """
    query = {}
    
    # Optional media type filter
    if media_type and media_type.lower() != "all":
        if media_type.lower() == "video":
            query["media_type"] = "video"
        elif media_type.lower() == "image":
            query["$or"] = [{"media_type": "image"}, {"media_type": {"$exists": False}}]

    # Optional severity filter
    if severity and severity.lower() != "all":
        query["highest_severity"] = severity

    # Fetch recent inspection records
    cursor = db.detections.find(query).sort("timestamp", -1).limit(limit)
    raw_records = await cursor.to_list(length=limit)

    located_list = []
    unlocated_list = []
    
    sum_lat = 0.0
    sum_lon = 0.0
    min_lat = float("inf")
    max_lat = float("-inf")
    min_lon = float("inf")
    max_lon = float("-inf")

    all_categories = set()
    all_severities = set()

    for doc in raw_records:
        doc_id = str(doc.get("_id", ""))
        det_id = doc.get("detection_id", f"DET-{doc_id[:8]}")
        m_type = doc.get("media_type", "image")
        highest_sev = doc.get("highest_severity", "None")
        sev_score = float(doc.get("severity_score", 0.0) or 0.0)
        est_cost = doc.get("estimated_cost", "₹0")
        timestamp = doc.get("timestamp", "")
        
        # Safe public media paths (strip absolute paths or server roots)
        img_url = doc.get("image_url") or doc.get("processed_image_path")
        preview_url = doc.get("preview_image_url") or doc.get("processed_image_path") or doc.get("image_url")
        if img_url:
            img_url = str(img_url).replace("\\", "/")
        if preview_url:
            preview_url = str(preview_url).replace("\\", "/")

        # Aggregate categories & defect count
        detections = doc.get("detections", [])
        cat_counts = doc.get("category_counts")
        if not cat_counts or not isinstance(cat_counts, dict):
            cat_counts = {
                "Pothole": 0,
                "Longitudinal Crack": 0,
                "Transverse Crack": 0,
                "Alligator Crack": 0
            }
            for d in detections:
                c_name = d.get("class") or d.get("class_name") or d.get("category") or "Defect"
                cat_counts[c_name] = cat_counts.get(c_name, 0) + 1

        defect_count = len(detections) if detections else sum(cat_counts.values())
        categories_present = [k for k, v in cat_counts.items() if v > 0]
        for c in categories_present:
            all_categories.add(c)
        if highest_sev and highest_sev != "None":
            all_severities.add(highest_sev)

        # Check category filter
        if category and category.lower() != "all":
            matched = any(c.lower() == category.lower() for c in categories_present)
            if not matched:
                continue

        # Extract and validate coordinates
        raw_lat = doc.get("latitude")
        raw_lon = doc.get("longitude")
        if raw_lat is None or raw_lon is None:
            gps_sub = doc.get("gps")
            if isinstance(gps_sub, dict):
                raw_lat = gps_sub.get("latitude")
                raw_lon = gps_sub.get("longitude")

        validated = validate_coordinates(raw_lat, raw_lon)
        gps_source = doc.get("gps_source") or (doc.get("gps", {}).get("source") if isinstance(doc.get("gps"), dict) else None) or "stored"

        if validated:
            v_lat, v_lon = validated
            located_list.append(
                GeoInspectionItem(
                    id=doc_id,
                    detection_id=det_id,
                    media_type=m_type,
                    latitude=v_lat,
                    longitude=v_lon,
                    gps_source=gps_source,
                    highest_severity=highest_sev,
                    severity_score=sev_score,
                    estimated_cost=est_cost,
                    defect_count=defect_count,
                    category_counts=cat_counts,
                    categories=categories_present,
                    timestamp=timestamp,
                    image_url=img_url,
                    preview_image_url=preview_url,
                    video_metadata=doc.get("video_metadata"),
                    severity_disclaimer=doc.get("severity_disclaimer"),
                    work_order_id=doc.get("work_order_id"),
                    work_order_status=doc.get("work_order_status")
                )
            )
            sum_lat += v_lat
            sum_lon += v_lon
            min_lat = min(min_lat, v_lat)
            max_lat = max(max_lat, v_lat)
            min_lon = min(min_lon, v_lon)
            max_lon = max(max_lon, v_lon)
        else:
            unlocated_list.append(
                UnlocatedInspectionItem(
                    id=doc_id,
                    detection_id=det_id,
                    media_type=m_type,
                    highest_severity=highest_sev,
                    severity_score=sev_score,
                    defect_count=defect_count,
                    category_counts=cat_counts,
                    categories=categories_present,
                    timestamp=timestamp,
                    image_url=img_url,
                    preview_image_url=preview_url,
                    missing_reason="No GPS coordinates provided or available in EXIF",
                    work_order_id=doc.get("work_order_id"),
                    work_order_status=doc.get("work_order_status")
                )
            )

    center = None
    bounds = None
    if located_list:
        center = [round(sum_lat / len(located_list), 6), round(sum_lon / len(located_list), 6)]
        bounds = {
            "min_lat": round(min_lat, 6),
            "max_lat": round(max_lat, 6),
            "min_lon": round(min_lon, 6),
            "max_lon": round(max_lon, 6),
        }
    else:
        # Sensible project default if no located records exist
        center = [13.0827, 80.2707]

    return GeoInspectionsResponse(
        located_inspections=located_list,
        unlocated_inspections=unlocated_list,
        meta={
            "total_inspections": len(located_list) + len(unlocated_list),
            "located_count": len(located_list),
            "unlocated_count": len(unlocated_list),
            "bounds": bounds,
            "center": center,
            "available_categories": sorted(list(all_categories)),
            "available_severities": sorted(list(all_severities))
        }
    )
