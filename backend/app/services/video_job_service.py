import time
import uuid
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("smartroadai.video_job_service")

class VideoJobManager:
    """
    Lightweight, in-memory job manager for asynchronous video processing tasks.
    Avoids heavy external message broker dependencies (e.g. Celery/Redis) while
    providing non-blocking background execution and real-time client polling.
    """
    _instance: Optional["VideoJobManager"] = None

    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_instance(cls) -> "VideoJobManager":
        if cls._instance is None:
            cls._instance = VideoJobManager()
        return cls._instance

    def create_job(self, filename: str, file_size_bytes: int) -> str:
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        self._jobs[job_id] = {
            "job_id": job_id,
            "filename": filename,
            "file_size_bytes": file_size_bytes,
            "status": "queued",  # "queued", "processing", "completed", "failed"
            "progress": 0,
            "message": "Video queued for analysis",
            "processed_frames": 0,
            "total_sampled_frames": 0,
            "defects_found": 0,
            "result": None,
            "error": None,
            "created_at": time.time(),
            "updated_at": time.time(),
        }
        # Keep job history bounded to latest 100 jobs
        if len(self._jobs) > 100:
            oldest_key = min(self._jobs.keys(), key=lambda k: self._jobs[k].get("created_at", 0))
            self._jobs.pop(oldest_key, None)
        return job_id

    def update_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        processed_frames: Optional[int] = None,
        total_sampled_frames: Optional[int] = None,
        defects_found: Optional[int] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ):
        if job_id not in self._jobs:
            return

        job = self._jobs[job_id]
        if status is not None:
            job["status"] = status
        if progress is not None:
            job["progress"] = min(100, max(0, progress))
        if message is not None:
            job["message"] = message
        if processed_frames is not None:
            job["processed_frames"] = processed_frames
        if total_sampled_frames is not None:
            job["total_sampled_frames"] = total_sampled_frames
        if defects_found is not None:
            job["defects_found"] = defects_found
        if result is not None:
            job["result"] = result
        if error is not None:
            job["error"] = error
        job["updated_at"] = time.time()

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self._jobs.get(job_id)

video_job_manager = VideoJobManager.get_instance()
