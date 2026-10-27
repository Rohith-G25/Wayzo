import os
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorDatabase
import cv2
import numpy as np

from app.config import settings
from app.utils.severity import calculate_severity, estimate_repair_cost, SEVERITY_HEURISTIC_DISCLAIMER
from app.utils.gps import extract_gps_metadata, get_mock_road_name, validate_coordinates
from app.utils.image_utils import get_relative_upload_path
from app.services.maintenance_service import MaintenanceService

logger = logging.getLogger("smartroadai.detection_service")

# Standardized defect name mapping for RDD2022 benchmark categories
RDD_CLASS_DISPLAY_NAMES = {
    "longitudinal_crack": "Longitudinal Crack",
    "transverse_crack": "Transverse Crack",
    "alligator_crack": "Alligator Crack",
    "pothole": "Pothole",
    "longitudinal crack": "Longitudinal Crack",
    "transverse crack": "Transverse Crack",
    "alligator crack": "Alligator Crack",
    "longitudinal-crack": "Longitudinal Crack",
    "transverse-crack": "Transverse Crack",
    "alligator-crack": "Alligator Crack",
}

# Distinct visual colors (BGR format for OpenCV) for each defect category
DEFECT_COLORS = {
    "Alligator Crack": (180, 50, 200),     # Vibrant Magenta/Purple
    "Pothole": (30, 40, 230),              # Deep Coral Red
    "Longitudinal Crack": (220, 160, 20),   # Cyan/Sky Blue
    "Transverse Crack": (20, 140, 240),    # Warm Amber
}

class DetectionService:
    _model = None
    _model_name: str = "RDD2022-YOLOv8s"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.maintenance_service = MaintenanceService(db)

    @classmethod
    def load_model(cls):
        """
        Load the fine-tuned Road Damage Detection YOLO model once during startup.
        Never falls back silently to COCO object detection.
        """
        if cls._model is not None:
            return

        from ultralytics import YOLO
        model_path = Path(settings.yolo_absolute_path)
        alt_rdd_path = model_path.parent / "rdd2022_yolov8s.pt"
        
        target_path = None
        if model_path.exists():
            target_path = str(model_path)
        elif alt_rdd_path.exists():
            target_path = str(alt_rdd_path)

        if not target_path or not os.path.exists(target_path):
            err_msg = (
                f"Road damage model weights not found at {model_path}. "
                "Ensure that fine-tuned RDD2022 model weights (e.g. rdd2022_yolov8s.pt or best.pt) "
                "are placed in ml/weights/. General-purpose COCO weights must not be substituted."
            )
            logger.critical(err_msg)
            raise FileNotFoundError(err_msg)

        try:
            cls._model = YOLO(target_path)
            cls._model_name = "RDD2022-YOLOv8s"
            logger.info(
                f"RDD Road Damage YOLO model successfully loaded from {target_path}. "
                f"Active classes: {list(cls._model.names.values())}"
            )
        except Exception as e:
            logger.critical(f"Failed to initialize Road Damage YOLO model: {e}")
            raise e

    def predict(self, source_path: str, conf: float = 0.25):
        """Run road damage inference using the loaded model with confidence thresholding."""
        if self._model is None:
            self.load_model()
        return self._model(source_path, conf=conf, verbose=False)

    @staticmethod
    def normalize_class_name(raw_name: str) -> str:
        """Map raw YOLO class identifier to clean display name without COCO substitution."""
        clean_key = raw_name.lower().strip()
        if clean_key in RDD_CLASS_DISPLAY_NAMES:
            return RDD_CLASS_DISPLAY_NAMES[clean_key]
        return clean_key.replace("_", " ").replace("-", " ").title()

    async def detect_image(
        self, 
        image_path: Path, 
        latitude: float = None, 
        longitude: float = None, 
        timestamp: datetime = None
    ) -> dict:
        """
        Process a single image, extract EXIF data, execute Road Damage YOLO detection,
        compute heuristic severity and cost, save to MongoDB, and trigger maintenance tickets.
        """
        start_time = time.time()
        
        # 1. Coordinate Extraction (Manual input -> EXIF metadata -> None)
        # Note: We strictly NEVER assign fabricated default GPS coordinates.
        gps_source = None
        validated_coords = validate_coordinates(latitude, longitude)
        if validated_coords:
            latitude, longitude = validated_coords
            gps_source = "manual"
        else:
            metadata_gps = extract_gps_metadata(str(image_path))
            if metadata_gps:
                latitude, longitude = metadata_gps
                gps_source = "exif"
            else:
                latitude, longitude = None, None
                gps_source = None
                
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)

        # 2. Decode Image & Verify
        img = cv2.imread(str(image_path))
        if img is None or img.size == 0:
            raise ValueError("Uploaded file could not be decoded as a valid image.")
        height, width, _ = img.shape

        # 3. Run Inference on RDD Model
        results = self.predict(str(image_path), conf=0.25)
        
        detections_list = []
        highest_severity = "Low"
        severity_order = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}

        for result in results:
            boxes = result.boxes
            for box in boxes:
                coords = [float(round(c, 2)) for c in box.xyxy[0].tolist()]  # [xmin, ymin, xmax, ymax]
                confidence = float(round(float(box.conf[0]), 4))
                class_id = int(box.cls[0])
                raw_class_name = result.names[class_id]
                
                # Standardize class name according to road damage taxonomy
                display_class_name = self.normalize_class_name(raw_class_name)
                
                # Calculate heuristic severity and estimated repair cost
                severity = calculate_severity(coords, confidence, width, height)
                estimated_cost = estimate_repair_cost(display_class_name, severity, coords, width, height)
                
                detections_list.append({
                    "class": display_class_name,
                    "confidence": confidence,
                    "severity": severity,
                    "bounding_box": coords,
                    "estimated_cost": estimated_cost
                })
                
                if severity_order.get(severity, 0) > severity_order.get(highest_severity, 0):
                    highest_severity = severity

                # Annotate image with high-visibility bounding box and labeled pill badge
                xmin, ymin, xmax, ymax = map(int, coords)
                box_color = DEFECT_COLORS.get(display_class_name, (0, 200, 100))
                
                # Draw defect bounding box
                cv2.rectangle(img, (xmin, ymin), (xmax, ymax), box_color, 2)
                
                # Draw labeled pill header badge
                label_text = f"{display_class_name} | {severity} ({confidence*100:.1f}%)"
                (text_w, text_h), baseline = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                badge_ymin = max(ymin - text_h - 10, 0)
                badge_ymax = badge_ymin + text_h + 8
                badge_xmax = min(xmin + text_w + 12, width)
                
                cv2.rectangle(img, (xmin, badge_ymin), (badge_xmax, badge_ymax), box_color, -1)
                cv2.putText(
                    img, label_text, (xmin + 6, badge_ymin + text_h + 3),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
                )

        # Draw inspection metadata watermark footer on annotated image
        footer_text = f"Wayzo Road AI ({self._model_name}) | Severity: Heuristic Assessment"
        (fw, fh), _ = cv2.getTextSize(footer_text, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)
        cv2.rectangle(img, (10, height - 26), (20 + fw, height - 6), (20, 20, 20), -1)
        cv2.putText(
            img, footer_text, (15, height - 12),
            cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1, cv2.LINE_AA
        )

        # 4. Save annotated processed image
        processed_filename = f"processed_{image_path.name}"
        processed_path = settings.upload_absolute_dir / "processed" / processed_filename
        os.makedirs(processed_path.parent, exist_ok=True)
        cv2.imwrite(str(processed_path), img)
        rel_processed_path = get_relative_upload_path(processed_path)

        # 5. Save Detections in MongoDB
        detection_id = f"DET-{uuid_hex()}"
        rel_filename = get_relative_upload_path(image_path)
        total_estimated_cost = sum_costs([d["estimated_cost"] for d in detections_list]) if detections_list else "₹0"
        severity_score_map = {"Critical": 9.2, "High": 7.5, "Medium": 5.0, "Low": 2.5}
        severity_score = severity_score_map.get(highest_severity, 0.0) if detections_list else 0.0

        gps_dict = {"latitude": latitude, "longitude": longitude, "source": gps_source} if (latitude is not None and longitude is not None) else None

        doc = {
            "detection_id": detection_id,
            "filename": rel_filename,
            "image_url": rel_processed_path,
            "processed_image_path": rel_processed_path,
            "latitude": latitude,
            "longitude": longitude,
            "gps": gps_dict,
            "gps_source": gps_source,
            "timestamp": timestamp.isoformat(),
            "detections": detections_list,
            "highest_severity": highest_severity if detections_list else "None",
            "severity_score": severity_score,
            "estimated_cost": total_estimated_cost,
            "processing_time": f"{time.time() - start_time:.3f}s",
            "model_name": self._model_name,
            "severity_disclaimer": SEVERITY_HEURISTIC_DISCLAIMER,
            "success": True
        }
        
        if self.db is not None:
            await self.db.detections.insert_one(doc)
        
        # 6. Automatically trigger Maintenance Ticket for any detections
        if detections_list and self.maintenance_service:
            road_name = get_mock_road_name(latitude, longitude) if (latitude is not None and longitude is not None) else "Unlocated Inspection Roadway"
            await self.maintenance_service.create_automatic_ticket(
                priority=highest_severity,
                road_name=road_name,
                latitude=latitude,
                longitude=longitude,
                estimated_cost=total_estimated_cost,
                detection_id=detection_id
            )

        return {
            "success": True,
            "filename": rel_filename,
            "image_url": rel_processed_path,
            "processed_image_path": rel_processed_path,
            "latitude": latitude,
            "longitude": longitude,
            "gps": gps_dict,
            "gps_source": gps_source,
            "highest_severity": highest_severity if detections_list else "None",
            "severity_score": severity_score,
            "estimated_cost": total_estimated_cost,
            "timestamp": timestamp.isoformat(),
            "detections": detections_list,
            "processing_time": f"{time.time() - start_time:.3f}s",
            "model_name": self._model_name,
            "severity_disclaimer": SEVERITY_HEURISTIC_DISCLAIMER
        }

    async def detect_video(
        self,
        video_path: Path,
        progress_callback: Optional[Any] = None,
        sample_interval_sec: Optional[float] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> dict:
        """
        Process a video file by sampling frames at configurable intervals,
        resizing frames to manage CPU/memory, applying Road Damage YOLO detection,
        annotating detected frames, aggregating defects by category and frame,
        and persisting results to MongoDB.
        """
        start_time = time.time()

        # Coordinate Validation (strictly reject fabricated coordinates)
        gps_source = None
        validated_coords = validate_coordinates(latitude, longitude)
        if validated_coords:
            latitude, longitude = validated_coords
            gps_source = "manual"
        else:
            latitude, longitude = None, None
            gps_source = None
        gps_dict = {"latitude": latitude, "longitude": longitude, "source": gps_source} if (latitude is not None and longitude is not None) else None
        
        # 1. Validate file exists and size
        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found at: {video_path}")
        
        file_size_mb = video_path.stat().st_size / (1024 * 1024)
        max_size_mb = getattr(settings, "MAX_VIDEO_UPLOAD_SIZE_MB", 100)
        if file_size_mb > max_size_mb:
            raise ValueError(f"Video file size ({file_size_mb:.1f} MB) exceeds maximum limit of {max_size_mb} MB.")

        # 2. Open with OpenCV & validate properties
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError("Corrupted video file or unsupported video codec.")

        out = None
        try:
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

            if width <= 0 or height <= 0 or total_frames <= 0 or fps <= 0:
                raise ValueError("Invalid or empty video file. Ensure the video contains valid visual frames.")

            duration_seconds = total_frames / fps
            max_duration = getattr(settings, "MAX_VIDEO_DURATION_SECONDS", 120)
            if duration_seconds > max_duration:
                raise ValueError(
                    f"Video duration ({duration_seconds:.1f}s) exceeds maximum limit of {max_duration} seconds."
                )

            # 3. Determine frame sampling interval
            interval_sec = sample_interval_sec or getattr(settings, "VIDEO_SAMPLE_INTERVAL_SECONDS", 1.0) or 1.0
            frame_step = max(1, int(round(fps * interval_sec)))
            sampled_indices = list(range(0, total_frames, frame_step))
            total_samples = len(sampled_indices)

            if progress_callback:
                progress_callback(0, total_samples, 0, f"Starting analysis of {total_samples} sampled frames...")

            # 4. Prepare directories and output preview video writer if supported
            detection_id = f"DET-VID-{uuid_hex()}"
            processed_dir = settings.upload_absolute_dir / "processed"
            os.makedirs(processed_dir, exist_ok=True)

            processed_video_filename = f"processed_{detection_id}.mp4"
            processed_video_path = processed_dir / processed_video_filename
            
            # Setup VideoWriter for annotated preview (sampled frames)
            max_dim = getattr(settings, "VIDEO_FRAME_MAX_DIMENSION", 960)
            target_w, target_h = width, height
            if max(width, height) > max_dim:
                scale = max_dim / max(width, height)
                target_w = int(width * scale)
                target_h = int(height * scale)
            
            # Make dimensions even for codec compatibility
            target_w = target_w if target_w % 2 == 0 else target_w - 1
            target_h = target_h if target_h % 2 == 0 else target_h - 1

            writer_fps = min(fps, 10.0)  # Preview playback fps
            try:
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                out = cv2.VideoWriter(str(processed_video_path), fourcc, writer_fps, (target_w, target_h))
            except Exception:
                out = None

            # 5. Process sampled frames
            all_detections_list = []
            frame_records = []
            pothole_count = 0
            longitudinal_crack_count = 0
            transverse_crack_count = 0
            alligator_crack_count = 0
            severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
            highest_severity = "None"
            severity_order = {"None": -1, "Low": 0, "Medium": 1, "High": 2, "Critical": 3}
            primary_preview_image = None
            max_defects_in_single_frame = -1

            if self._model is None:
                self.load_model()

            for sample_idx, frame_idx in enumerate(sampled_indices):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                timestamp_sec = frame_idx / fps
                formatted_time = format_timestamp(timestamp_sec)

                # Resize frame if needed to control memory/CPU
                if (frame.shape[1], frame.shape[0]) != (target_w, target_h):
                    frame = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)

                cur_h, cur_w, _ = frame.shape

                # Run inference on current frame
                results = self._model(frame, conf=0.25, verbose=False)
                frame_defects = []
                frame_highest_sev = "None"

                for result in results:
                    boxes = result.boxes
                    for box in boxes:
                        coords = [float(round(c, 2)) for c in box.xyxy[0].tolist()]
                        confidence = float(round(float(box.conf[0]), 4))
                        class_id = int(box.cls[0])
                        raw_class_name = result.names[class_id]
                        display_name = self.normalize_class_name(raw_class_name)

                        severity = calculate_severity(coords, confidence, cur_w, cur_h)
                        cost = estimate_repair_cost(display_name, severity, coords, cur_w, cur_h)

                        defect_item = {
                            "class": display_name,
                            "confidence": confidence,
                            "severity": severity,
                            "bounding_box": coords,
                            "estimated_cost": cost,
                            "frame_number": frame_idx,
                            "timestamp_sec": round(timestamp_sec, 2),
                            "formatted_time": formatted_time
                        }
                        frame_defects.append(defect_item)
                        all_detections_list.append(defect_item)

                        # Category breakdown tally
                        c_low = display_name.lower()
                        if "pothole" in c_low:
                            pothole_count += 1
                        elif "alligator" in c_low:
                            alligator_crack_count += 1
                        elif "longitudinal" in c_low:
                            longitudinal_crack_count += 1
                        elif "transverse" in c_low:
                            transverse_crack_count += 1

                        severity_counts[severity] = severity_counts.get(severity, 0) + 1

                        if severity_order.get(severity, 0) > severity_order.get(highest_severity, -1):
                            highest_severity = severity
                        if severity_order.get(severity, 0) > severity_order.get(frame_highest_sev, -1):
                            frame_highest_sev = severity

                        # Annotate frame
                        xmin, ymin, xmax, ymax = map(int, coords)
                        box_color = DEFECT_COLORS.get(display_name, (0, 200, 100))
                        cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), box_color, 2)

                        label_text = f"{display_name} | {severity} ({confidence*100:.1f}%)"
                        (text_w, text_h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                        b_ymin = max(ymin - text_h - 10, 0)
                        b_ymax = b_ymin + text_h + 8
                        b_xmax = min(xmin + text_w + 12, cur_w)

                        cv2.rectangle(frame, (xmin, b_ymin), (b_xmax, b_ymax), box_color, -1)
                        cv2.putText(
                            frame, label_text, (xmin + 6, b_ymin + text_h + 3),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
                        )

                # Watermark footer
                watermark = f"Wayzo Video AI ({self._model_name}) | Time: {formatted_time} | Frame {sample_idx + 1}/{total_samples}"
                (fw, fh), _ = cv2.getTextSize(watermark, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)
                cv2.rectangle(frame, (10, cur_h - 26), (20 + fw, cur_h - 6), (20, 20, 20), -1)
                cv2.putText(
                    frame, watermark, (15, cur_h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, (220, 220, 220), 1, cv2.LINE_AA
                )

                # Write to preview video if writer is active
                if out is not None:
                    out.write(frame)

                # Save keyframe preview image if defects detected or first frame
                frame_img_rel_path = None
                if len(frame_defects) > 0 or sample_idx == 0:
                    frame_img_name = f"frame_{detection_id}_{frame_idx}.jpg"
                    frame_img_path = processed_dir / frame_img_name
                    cv2.imwrite(str(frame_img_path), frame)
                    frame_img_rel_path = get_relative_upload_path(frame_img_path)

                if len(frame_defects) > max_defects_in_single_frame and frame_img_rel_path:
                    max_defects_in_single_frame = len(frame_defects)
                    primary_preview_image = frame_img_rel_path

                frame_records.append({
                    "frame_number": frame_idx,
                    "timestamp_sec": round(timestamp_sec, 2),
                    "formatted_time": formatted_time,
                    "defect_count": len(frame_defects),
                    "highest_severity": frame_highest_sev,
                    "preview_image": frame_img_rel_path,
                    "detections": frame_defects
                })

                # Report progress
                if progress_callback:
                    pct = int(((sample_idx + 1) / total_samples) * 100)
                    progress_callback(
                        sample_idx + 1,
                        total_samples,
                        len(all_detections_list),
                        f"Analyzed {sample_idx + 1}/{total_samples} frames ({len(all_detections_list)} defects localized)"
                    )

        finally:
            cap.release()
            if out is not None:
                out.release()

        # 6. Fallback preview image if none was assigned
        if not primary_preview_image and frame_records and frame_records[0].get("preview_image"):
            primary_preview_image = frame_records[0]["preview_image"]

        rel_processed_video = get_relative_upload_path(processed_video_path) if processed_video_path.exists() else None
        rel_video_file = get_relative_upload_path(video_path)

        total_defects_count = len(all_detections_list)
        total_estimated_cost = sum_costs([d["estimated_cost"] for d in all_detections_list]) if all_detections_list else "₹0"
        severity_score_map = {"Critical": 9.2, "High": 7.5, "Medium": 5.0, "Low": 2.5, "None": 0.0}
        severity_score = severity_score_map.get(highest_severity, 0.0)

        category_counts = {
            "Pothole": pothole_count,
            "Longitudinal Crack": longitudinal_crack_count,
            "Transverse Crack": transverse_crack_count,
            "Alligator Crack": alligator_crack_count
        }

        # 7. Persist to MongoDB
        doc = {
            "detection_id": detection_id,
            "media_type": "video",
            "filename": rel_video_file,
            "image_url": primary_preview_image or rel_processed_video,
            "processed_image_path": primary_preview_image,
            "processed_video_path": rel_processed_video,
            "latitude": latitude,
            "longitude": longitude,
            "gps": gps_dict,
            "gps_source": gps_source,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "video_metadata": {
                "duration_seconds": round(duration_seconds, 2),
                "total_video_frames": total_frames,
                "sampled_frames": len(frame_records),
                "sample_interval_sec": interval_sec,
                "damages_detected": total_defects_count,
                "highest_severity": highest_severity,
                "pothole_count": pothole_count,
                "longitudinal_crack_count": longitudinal_crack_count,
                "transverse_crack_count": transverse_crack_count,
                "alligator_crack_count": alligator_crack_count,
                "category_counts": category_counts
            },
            "category_counts": category_counts,
            "highest_severity": highest_severity,
            "severity_score": severity_score,
            "estimated_cost": total_estimated_cost,
            "detections": all_detections_list,
            "frame_detections": frame_records,
            "model_name": self._model_name,
            "severity_disclaimer": SEVERITY_HEURISTIC_DISCLAIMER,
            "processing_time": f"{time.time() - start_time:.3f}s",
            "success": True
        }

        if self.db is not None:
            await self.db.detections.insert_one(doc)

        # 8. Create maintenance ticket if defects found
        if total_defects_count > 0 and self.maintenance_service:
            road_name = get_mock_road_name(latitude, longitude) if (latitude is not None and longitude is not None) else "Unlocated Video Inspection Route"
            await self.maintenance_service.create_automatic_ticket(
                priority=highest_severity,
                road_name=road_name,
                latitude=latitude,
                longitude=longitude,
                estimated_cost=total_estimated_cost,
                detection_id=detection_id
            )

        return {
            "success": True,
            "detection_id": detection_id,
            "media_type": "video",
            "filename": rel_video_file,
            "processed_video_path": rel_processed_video,
            "preview_image_url": primary_preview_image,
            "latitude": latitude,
            "longitude": longitude,
            "gps": gps_dict,
            "gps_source": gps_source,
            "duration_seconds": round(duration_seconds, 2),
            "total_frames": total_frames,
            "sampled_frames": len(frame_records),
            "sample_interval_sec": interval_sec,
            "damages_detected": total_defects_count,
            "highest_severity": highest_severity,
            "severity_score": severity_score,
            "estimated_cost": total_estimated_cost,
            "category_counts": category_counts,
            "frame_detections": frame_records,
            "detections": all_detections_list,
            "timestamp": doc["timestamp"],
            "processing_time": f"{time.time() - start_time:.3f}s",
            "model_name": self._model_name,
            "severity_disclaimer": SEVERITY_HEURISTIC_DISCLAIMER
        }

def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def uuid_hex() -> str:
    import uuid
    return uuid.uuid4().hex[:8]

def sum_costs(costs: list[str]) -> str:
    total = 0
    for cost in costs:
        try:
            val = int(cost.replace("₹", "").strip())
            total += val
        except Exception:
            pass
    return f"₹{total}"
