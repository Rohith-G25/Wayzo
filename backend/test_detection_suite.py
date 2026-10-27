import os
import sys
import asyncio
from pathlib import Path
from PIL import Image, ImageDraw
import httpx
from starlette.testclient import TestClient

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app
from app.config import settings

def run_tests():
    print("=" * 60)
    print("STARTING IMAGE DETECTION VERIFICATION TEST SUITE")
    print("=" * 60)

    # 1. Create a test valid image with visual features
    valid_img_path = backend_dir / "temp_valid_road.jpg"
    img = Image.new("RGB", (640, 640), color=(128, 128, 128))
    draw = ImageDraw.Draw(img)
    # Draw road lane markings and a dark shape (simulating pothole or object)
    draw.rectangle([0, 300, 640, 640], fill=(60, 60, 60))
    draw.rectangle([250, 450, 390, 550], fill=(20, 20, 20))
    draw.line([320, 0, 320, 300], fill=(255, 255, 255), width=8)
    img.save(valid_img_path, format="JPEG")

    # 2. Create invalid file with .txt extension
    invalid_ext_path = backend_dir / "temp_invalid.txt"
    with open(invalid_ext_path, "w") as f:
        f.write("This is a plain text file, not an image.")

    # 3. Create invalid file with .jpg extension but corrupt/text content
    corrupt_img_path = backend_dir / "temp_corrupt.jpg"
    with open(corrupt_img_path, "w") as f:
        f.write("Corrupted file content purporting to be JPEG")

    with TestClient(app) as client:
        # Test 1: Health check
        print("\n--- TEST 1: Health Check ---")
        health_res = client.get("/health")
        print("Health status code:", health_res.status_code)
        print("Health body:", health_res.json())
        assert health_res.status_code == 200
        assert health_res.json().get("status") == "online"
        print("✓ Health Check Passed")

        # Authenticate test client with administrator account for protected API calls
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@wayzo.gov", "password": "AdminPass123!"}
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.json()}"
        suite_token = login_res.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {suite_token}"
        print("✓ Test Client Authenticated with Admin Token (admin@wayzo.gov)")

        # Test 2: Invalid extension upload (temp_invalid.txt)
        print("\n--- TEST 2: Invalid Extension Upload ---")
        with open(invalid_ext_path, "rb") as f:
            res_invalid_ext = client.post(
                "/api/v1/detect/image",
                files={"file": ("temp_invalid.txt", f, "text/plain")}
            )
        print("Status code:", res_invalid_ext.status_code)
        print("Response body:", res_invalid_ext.json())
        assert res_invalid_ext.status_code == 400
        assert "Invalid image format" in res_invalid_ext.json().get("detail", "")
        print("✓ Invalid Extension Gracefully Handled (400 Bad Request)")

        # Test 3: Corrupt image file with .jpg extension (temp_corrupt.jpg)
        print("\n--- TEST 3: Corrupt Image Content Upload ---")
        with open(corrupt_img_path, "rb") as f:
            res_corrupt = client.post(
                "/api/v1/detect/image",
                files={"file": ("temp_corrupt.jpg", f, "image/jpeg")}
            )
        print("Status code:", res_corrupt.status_code)
        print("Response body:", res_corrupt.json())
        assert res_corrupt.status_code == 400
        assert "could not be decoded" in res_corrupt.json().get("detail", "")
        print("✓ Corrupt Image Gracefully Handled (400 Bad Request)")

        # Test 4: Valid image upload
        print("\n--- TEST 4: Valid Image Upload & Detection ---")
        with open(valid_img_path, "rb") as f:
            res_valid = client.post(
                "/api/v1/detect/image",
                files={"file": ("test_road_upload.jpg", f, "image/jpeg")},
                data={"latitude": 28.6139, "longitude": 77.2090}
            )
        print("Status code:", res_valid.status_code)
        val_data = res_valid.json()
        print("Response keys:", list(val_data.keys()))
        print("Success:", val_data.get("success"))
        print("Original filename:", val_data.get("filename"))
        print("Processed image path:", val_data.get("processed_image_path"))
        print("Image URL:", val_data.get("image_url"))
        print("GPS:", val_data.get("gps"))
        print("Highest severity:", val_data.get("highest_severity"))
        print("Detections count:", len(val_data.get("detections", [])))
        print("Processing time:", val_data.get("processing_time"))

        assert res_valid.status_code == 200
        assert val_data.get("success") is True
        assert val_data.get("filename") is not None
        assert val_data.get("image_url") is not None

        # Verify that original uploaded file exists on disk
        saved_original = backend_dir / val_data["filename"]
        print("Checking saved original on disk:", saved_original)
        assert saved_original.exists(), f"Uploaded file {saved_original} was not found on disk!"
        print("✓ Uploaded file saved to correct directory:", saved_original)

        # Verify that processed annotated image exists on disk
        saved_processed = backend_dir / val_data["processed_image_path"]
        print("Checking saved processed image on disk:", saved_processed)
        assert saved_processed.exists(), f"Processed image {saved_processed} was not found on disk!"
        print("✓ Processed image saved to correct directory:", saved_processed)

        # Test 5: Verify static files can serve the uploaded & processed image
        print("\n--- TEST 5: Verify Static File Serving ---")
        orig_url = "/" + val_data["filename"].lstrip("/")
        proc_url = "/" + val_data["image_url"].lstrip("/")
        res_static_orig = client.get(orig_url)
        res_static_proc = client.get(proc_url)
        print(f"GET {orig_url} -> status:", res_static_orig.status_code)
        print(f"GET {proc_url} -> status:", res_static_proc.status_code)
        assert res_static_orig.status_code == 200
        assert res_static_proc.status_code == 200
        print("✓ Both original and processed images are correctly served via static routes")

        # Test 6: Verify MongoDB record storage
        print("\n--- TEST 6: Verify MongoDB Storage ---")
        history_res = client.get("/api/v1/detect/detections")
        print("Historical detections count:", len(history_res.json()))
        assert history_res.status_code == 200
        records = history_res.json()
        assert len(records) > 0
        matching = [r for r in records if r.get("filename") == val_data["filename"]]
        print("Found inserted record in MongoDB:", bool(matching))
        assert len(matching) > 0, "Detection record was not found in MongoDB!"
        print("✓ Detection record successfully verified in MongoDB")

        # Test 7: Verify Road Damage Detection on Real RDD Defect Image
        print("\n--- TEST 7: Verify Road Damage Detection on Real RDD Defect Image ---")
        rdd_sample_path = backend_dir / "uploads" / "China_Drone_000040.jpg"
        if rdd_sample_path.exists():
            with open(rdd_sample_path, "rb") as f:
                res_rdd = client.post(
                    "/api/v1/detect/image",
                    files={"file": ("rdd_defect_sample.jpg", f, "image/jpeg")},
                    data={"latitude": 13.0827, "longitude": 80.2707}
                )
            assert res_rdd.status_code == 200, f"RDD detection failed: {res_rdd.text}"
            rdd_data = res_rdd.json()
            print("RDD Detection Success:", rdd_data.get("success"))
            print("Model Used:", rdd_data.get("model_name"))
            print("Severity Disclaimer:", rdd_data.get("severity_disclaimer"))
            print("Highest Severity:", rdd_data.get("highest_severity"))
            print("Estimated Cost:", rdd_data.get("estimated_cost"))
            print("Detections Count:", len(rdd_data.get("detections", [])))
            for idx, det in enumerate(rdd_data.get("detections", [])):
                print(f"  [{idx+1}] Class: {det.get('class')}, Conf: {det.get('confidence')}, Severity: {det.get('severity')}, BBox: {det.get('bounding_box')}, Cost: {det.get('estimated_cost')}")
            
            assert len(rdd_data.get("detections", [])) > 0, "Expected at least 1 real road defect detected in RDD image!"
            valid_rdd_classes = {"Longitudinal Crack", "Transverse Crack", "Alligator Crack", "Pothole"}
            for det in rdd_data["detections"]:
                assert det["class"] in valid_rdd_classes, f"Unexpected class {det['class']}"
                assert 0.0 <= det["confidence"] <= 1.0
                assert len(det["bounding_box"]) == 4
                assert det["severity"] in {"Low", "Medium", "High", "Critical"}
            assert rdd_data.get("model_name") == "RDD2022-YOLOv8s"
            assert "heuristic" in rdd_data.get("severity_disclaimer", "").lower()
            print("✓ Real road damage detection successfully verified with certified RDD classes and heuristic disclaimers")
        else:
            print("Note: China_Drone_000040.jpg not found, skipping Test 7")

        # --- TEST 8: Invalid Video Extension Upload ---
        print("\n--- TEST 8: Invalid Video Extension Upload ---")
        with open(invalid_ext_path, "rb") as f:
            res_invalid_vid = client.post(
                "/api/v1/detect/video",
                files={"file": ("invalid_video.txt", f, "text/plain")}
            )
        print("Status code:", res_invalid_vid.status_code)
        print("Response body:", res_invalid_vid.json())
        assert res_invalid_vid.status_code == 400
        assert "Invalid video format" in res_invalid_vid.json().get("detail", "")
        print("✓ Invalid Video Extension Gracefully Handled (400 Bad Request)")

        # --- TEST 9: Corrupt Video Content Upload ---
        print("\n--- TEST 9: Corrupt Video Content Upload ---")
        corrupt_vid_path = backend_dir / "temp_corrupt_video.mp4"
        with open(corrupt_vid_path, "wb") as f:
            f.write(b"Corrupted video header and payload bytes without valid moov atom")

        with open(corrupt_vid_path, "rb") as f:
            res_corrupt_vid = client.post(
                "/api/v1/detect/video",
                files={"file": ("corrupt_road.mp4", f, "video/mp4")}
            )
        print("Status code:", res_corrupt_vid.status_code)
        print("Response body:", res_corrupt_vid.json())
        assert res_corrupt_vid.status_code == 400
        assert "Corrupted video file" in res_corrupt_vid.json().get("detail", "") or "Invalid" in res_corrupt_vid.json().get("detail", "")
        print("✓ Corrupt Video Content Gracefully Handled (400 Bad Request)")

        # --- TEST 10: Valid Video Synthesis & Sampled Frame Processing ---
        print("\n--- TEST 10: Valid Video Synthesis & Sampled Frame Processing ---")
        import cv2
        import numpy as np

        valid_vid_path = backend_dir / "temp_valid_road_stream.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        vw = cv2.VideoWriter(str(valid_vid_path), fourcc, 10.0, (320, 240))
        for f_idx in range(30):
            frame = np.full((240, 320, 3), 60, dtype=np.uint8)
            cv2.line(frame, (160, 0), (160, 240), (255, 255, 255), 3)
            cv2.rectangle(frame, (90, 80), (220, 160), (25, 25, 25), -1)
            vw.write(frame)
        vw.release()

        with open(valid_vid_path, "rb") as f:
            res_valid_vid = client.post(
                "/api/v1/detect/video",
                files={"file": ("valid_road_survey.mp4", f, "video/mp4")},
                data={"latitude": 13.0827, "longitude": 80.2707, "sample_interval_sec": 1.0}
            )
        print("Status code:", res_valid_vid.status_code)
        vid_data = res_valid_vid.json()
        print("Video detection keys:", list(vid_data.keys()))
        print("Success:", vid_data.get("success"))
        print("Detection ID:", vid_data.get("detection_id"))
        print("Duration seconds:", vid_data.get("duration_seconds"))
        print("Total frames:", vid_data.get("total_frames"))
        print("Sampled frames:", vid_data.get("sampled_frames"))
        print("Damages detected:", vid_data.get("damages_detected"))
        print("Category counts:", vid_data.get("category_counts"))
        print("Frame detections count:", len(vid_data.get("frame_detections", [])))
        print("Severity disclaimer:", vid_data.get("severity_disclaimer"))

        assert res_valid_vid.status_code == 200
        assert vid_data.get("success") is True
        assert vid_data.get("total_frames") == 30
        assert vid_data.get("sampled_frames") >= 3
        assert vid_data.get("duration_seconds") > 2.0
        assert "category_counts" in vid_data
        assert "Pothole" in vid_data["category_counts"]
        assert len(vid_data.get("frame_detections", [])) > 0
        assert "heuristic" in vid_data.get("severity_disclaimer", "").lower()
        print("✓ Synchronous Video Detection & Sampling Passed")

        # --- TEST 11: Asynchronous Video Job Start and Status Polling ---
        print("\n--- TEST 11: Asynchronous Video Job Start & Status Polling ---")
        with open(valid_vid_path, "rb") as f:
            res_job_start = client.post(
                "/api/v1/detect/video/start",
                files={"file": ("async_road_survey.mp4", f, "video/mp4")},
                data={"latitude": 13.0827, "longitude": 80.2707, "sample_interval_sec": 1.0}
            )
        print("Job start status code:", res_job_start.status_code)
        job_data = res_job_start.json()
        print("Job start response:", job_data)
        assert res_job_start.status_code == 202
        assert "job_id" in job_data
        job_id = job_data["job_id"]
        assert job_data.get("status") in {"queued", "processing", "completed"}

        # Poll status
        import time
        max_polls = 10
        completed = False
        final_job_status = None
        for p in range(max_polls):
            time.sleep(0.5)
            poll_res = client.get(f"/api/v1/detect/video/status/{job_id}")
            assert poll_res.status_code == 200
            final_job_status = poll_res.json()
            print(f"Poll #{p+1}: status={final_job_status.get('status')}, progress={final_job_status.get('progress')}%, msg='{final_job_status.get('message')}'")
            if final_job_status.get("status") == "completed":
                completed = True
                break
        
        assert completed, f"Job did not complete in time. Last status: {final_job_status}"
        assert final_job_status.get("result") is not None
        assert final_job_status["result"]["success"] is True
        print("✓ Asynchronous Video Background Job & Polling Passed")

        # --- TEST 12: Video MongoDB Persistence & Shared Analytics Aggregation ---
        print("\n--- TEST 12: Video MongoDB Storage & Single Session Counting ---")
        history_res2 = client.get("/api/v1/detect/history?limit=10&skip=0")
        assert history_res2.status_code == 200
        hist_data = history_res2.json()
        assert "items" in hist_data
        # Verify video inspection appears with media_type video or video_metadata
        video_items = [item for item in hist_data["items"] if item.get("media_type") == "video" or item.get("video_metadata")]
        assert len(video_items) > 0, "Video inspection record not found in MongoDB history!"
        print(f"Found {len(video_items)} video inspection record(s) in history.")
        latest_vid = video_items[0]
        print("Latest video detection ID:", latest_vid.get("detection_id"))
        print("Video metadata:", latest_vid.get("video_metadata"))

        # Verify analytics endpoint counts the video inspection as 1 session
        stats_res = client.get("/api/v1/statistics")
        assert stats_res.status_code == 200
        stats_data = stats_res.json()
        print("Total inspections in DB:", stats_data.get("totalInspections"))
        print("Total defects in DB:", stats_data.get("totalDefects"))
        assert stats_data.get("totalInspections", 0) > 0
        print("✓ MongoDB Storage and Analytics Verified")

        # --- TEST 13: Regression Image Detection After Video Operations ---
        print("\n--- TEST 13: Regression Image Detection After Video Inference ---")
        with open(valid_img_path, "rb") as f:
            res_reg = client.post(
                "/api/v1/detect/image",
                files={"file": ("regression_road.jpg", f, "image/jpeg")},
                data={"latitude": 28.6139, "longitude": 77.2090}
            )
        assert res_reg.status_code == 200
        assert res_reg.json().get("success") is True
        print("✓ Regression Image Detection Passes Without Degradation")

        # --- TEST 14: Valid GPS Coordinates Upload & Extraction ---
        print("\n--- TEST 14: Valid GPS Coordinates Upload & Tagging ---")
        bengaluru_lat, bengaluru_lon = 12.9716, 77.5946
        with open(valid_img_path, "rb") as f:
            res_geo_valid = client.post(
                "/api/v1/detect/image",
                files={"file": ("valid_geo_road.jpg", f, "image/jpeg")},
                data={"latitude": bengaluru_lat, "longitude": bengaluru_lon}
            )
        assert res_geo_valid.status_code == 200
        valid_geo_data = res_geo_valid.json()
        assert valid_geo_data.get("latitude") == bengaluru_lat
        assert valid_geo_data.get("longitude") == bengaluru_lon
        assert valid_geo_data.get("gps_source") == "manual"
        assert valid_geo_data.get("gps") is not None
        assert valid_geo_data["gps"]["latitude"] == bengaluru_lat
        print("✓ Valid GPS Coordinates Processed and Tagged as Manual Input")

        # --- TEST 15: Missing GPS Coordinates (No EXIF, No Form Coords) ---
        print("\n--- TEST 15: Missing GPS Coordinates (Omitted Coordinates) ---")
        with open(valid_img_path, "rb") as f:
            res_unlocated = client.post(
                "/api/v1/detect/image",
                files={"file": ("unlocated_road.jpg", f, "image/jpeg")}
            )
        assert res_unlocated.status_code == 200
        unlocated_data = res_unlocated.json()
        # Strictly verify NO fabricated coordinates (must be None)
        assert unlocated_data.get("latitude") is None, "Should not fabricate default latitude"
        assert unlocated_data.get("longitude") is None, "Should not fabricate default longitude"
        assert unlocated_data.get("gps") is None
        assert unlocated_data.get("gps_source") is None
        print("✓ Omitted GPS Coordinates Left as None (Zero Fabrication)")

        # --- TEST 16: Invalid Latitude and Longitude Rejection ---
        print("\n--- TEST 16: Invalid Latitude and Longitude Rejection ---")
        with open(valid_img_path, "rb") as f:
            res_invalid_coords = client.post(
                "/api/v1/detect/image",
                files={"file": ("invalid_coords_road.jpg", f, "image/jpeg")},
                data={"latitude": 195.0, "longitude": -250.0}
            )
        assert res_invalid_coords.status_code == 200
        invalid_coords_data = res_invalid_coords.json()
        # Out-of-bounds lat/lon (-90 to 90, -180 to 180) must be sanitized to None
        assert invalid_coords_data.get("latitude") is None
        assert invalid_coords_data.get("longitude") is None
        assert invalid_coords_data.get("gps") is None
        print("✓ Out-of-range Coordinates Safely Excluded from Geolocation")

        # --- TEST 17: Video Inspection Genuine Coordinates & Media Distinction ---
        print("\n--- TEST 17: Video Inspection With Valid GPS Coordinates ---")
        with open(valid_vid_path, "rb") as f:
            res_vid_geo = client.post(
                "/api/v1/detect/video",
                files={"file": ("geo_video.mp4", f, "video/mp4")},
                data={"latitude": 13.0827, "longitude": 80.2707, "sample_interval_sec": 1.0}
            )
        assert res_vid_geo.status_code == 200
        vid_geo_data = res_vid_geo.json()
        assert vid_geo_data.get("media_type") == "video"
        assert vid_geo_data.get("latitude") == 13.0827
        assert vid_geo_data.get("longitude") == 80.2707
        assert vid_geo_data.get("gps_source") == "manual"
        print("✓ Video Inspection Correctly Assigned Genuine GPS Coordinates")

        # --- TEST 18: GET /geo-inspections Endpoint & Unlocated Separation ---
        print("\n--- TEST 18: Geo-Inspections Endpoint & Unlocated Separation ---")
        geo_all_res = client.get("/api/v1/detect/geo-inspections")
        assert geo_all_res.status_code == 200
        geo_all_data = geo_all_res.json()
        assert "located_inspections" in geo_all_data
        assert "unlocated_inspections" in geo_all_data
        assert "meta" in geo_all_data

        located_items = geo_all_data["located_inspections"]
        unlocated_items = geo_all_data["unlocated_inspections"]
        meta_info = geo_all_data["meta"]

        print(f"Located count: {len(located_items)}, Unlocated count: {len(unlocated_items)}")
        assert len(located_items) > 0, "Expected at least 1 located inspection"
        assert len(unlocated_items) > 0, "Expected at least 1 unlocated inspection (from Test 15/16)"

        # Check bounds and centroid
        assert meta_info.get("bounds") is not None
        assert "min_lat" in meta_info["bounds"]
        assert meta_info.get("center") is not None
        print(f"Calculated Bounding Box: {meta_info['bounds']}")
        print(f"Calculated Map Center: {meta_info['center']}")

        # Ensure all located inspections strictly have valid float coordinates
        for loc in located_items:
            assert -90.0 <= loc["latitude"] <= 90.0
            assert -180.0 <= loc["longitude"] <= 180.0
            assert loc["media_type"] in ["image", "video"]
            assert loc["defect_count"] >= 0
            assert loc["highest_severity"] is not None

        # Ensure unlocated items are marked with valid missing reasons
        for unloc in unlocated_items:
            assert "missing_reason" in unloc

        print("✓ Geographic Integrity Confirmed: Strict coordinate validation & separation")

        # --- TEST 19: Category, Severity, and Media Type Filtering ---
        print("\n--- TEST 19: Map Filters (Media Type, Severity, Category) ---")
        # Video filter
        video_filtered_res = client.get("/api/v1/detect/geo-inspections?media_type=video")
        assert video_filtered_res.status_code == 200
        video_items = video_filtered_res.json()["located_inspections"]
        for vi in video_items:
            assert vi["media_type"] == "video"
        print(f"✓ Media type filter (video): {len(video_items)} records returned")

        # Severity filter
        sev_filtered_res = client.get("/api/v1/detect/geo-inspections?severity=Critical")
        assert sev_filtered_res.status_code == 200
        sev_items = sev_filtered_res.json()["located_inspections"]
        for si in sev_items:
            assert si["highest_severity"] == "Critical"
        print(f"✓ Severity filter (Critical): {len(sev_items)} records returned")

        # Empty match filter (Zero-results state handling)
        empty_res = client.get("/api/v1/detect/geo-inspections?severity=NonExistentSeverity")
        assert empty_res.status_code == 200
        empty_data = empty_res.json()
        assert len(empty_data["located_inspections"]) == 0
        assert empty_data["meta"]["located_count"] == 0
        print("✓ Empty Filter Query Gracefully Handled With Zero Pins")

        # --- TEST 20: Regression Check: Image Detection, Video Detection, and Analytics ---
        print("\n--- TEST 20: Complete System Regression Check ---")
        hist_res = client.get("/api/v1/detect/history?limit=10&skip=0")
        assert hist_res.status_code == 200
        assert "items" in hist_res.json()
        assert hist_res.json().get("total") > 0

        final_stats_res = client.get("/api/v1/statistics")
        assert final_stats_res.status_code == 200
        final_stats = final_stats_res.json()
        assert final_stats.get("totalInspections") > 0
        assert final_stats.get("totalDefects") >= 0
        print(f"✓ Final Analytics: {final_stats.get('totalInspections')} total inspections, {final_stats.get('totalDefects')} defects logged")
        print("✓ Full Detection, Video, and Analytics Pipeline Remained Intact")

        # --- TEST 21: Work Order Manual Creation & Schema Verification ---
        print("\n--- TEST 21: Work Order Manual Creation & Schema Verification ---")
        wo_payload = {
            "road_name": "MG Road Corridor, Km 4.2",
            "priority": "High",
            "damage_category": "Pothole",
            "description": "Deep localized pothole on inner traffic lane requiring hot-mix asphalt patching.",
            "estimated_cost": "₹16,500",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        res_wo_create = client.post("/api/v1/maintenance", json=wo_payload)
        assert res_wo_create.status_code == 201
        wo_data = res_wo_create.json()
        wo_id_manual = wo_data["work_order_id"]
        assert wo_id_manual.startswith("WO-")
        assert wo_data["status"] == "Open"
        assert wo_data["road_name"] == "MG Road Corridor, Km 4.2"
        assert wo_data["priority"] == "High"
        assert wo_data["damage_category"] == "Pothole"
        assert wo_data["gps"]["latitude"] == 12.9716
        assert len(wo_data["status_history"]) == 1
        assert wo_data["status_history"][0]["to_status"] == "Open"
        assert "severity_disclaimer" in wo_data
        assert "cost_disclaimer" in wo_data
        print(f"✓ Work Order {wo_id_manual} Created with Genuine Attributes & Audit Trail")

        # --- TEST 22: Work Order Creation from Existing Inspection (DB Record Verification) ---
        print("\n--- TEST 22: Work Order Creation from Verified Inspection Record ---")
        # Find the detection session created in Test 14 with Bengaluru coordinates
        det_record = client.get("/api/v1/detect/history?limit=5").json()["items"][0]
        real_det_id = det_record.get("detection_id") or det_record.get("id")

        wo_from_insp_payload = {
            "inspection_id": real_det_id,
            "road_name": "Verified Highway Sector",
            "description": "Patching required from verified AI road inspection"
        }
        res_wo_insp = client.post("/api/v1/maintenance/from-inspection", json=wo_from_insp_payload)
        assert res_wo_insp.status_code == 201
        wo_insp_data = res_wo_insp.json()
        wo_id_linked = wo_insp_data["work_order_id"]
        assert wo_insp_data["inspection_id"] == real_det_id
        # Coordinates must match verified database record without fabrication
        if det_record.get("latitude"):
            assert wo_insp_data["gps"]["latitude"] == det_record["latitude"]
            assert wo_insp_data["gps"]["longitude"] == det_record["longitude"]
        print(f"✓ Linked Work Order {wo_id_linked} Created from Real Inspection {real_det_id} with Verified GPS")

        # --- TEST 23: Rejection of Non-existent Inspection ID (404 Validation) ---
        print("\n--- TEST 23: Non-existent Inspection ID Rejection (404) ---")
        fake_insp_payload = {
            "inspection_id": "DET-NONEXISTENT-9999",
            "road_name": "Ghost Road"
        }
        res_fake_insp = client.post("/api/v1/maintenance/from-inspection", json=fake_insp_payload)
        assert res_fake_insp.status_code == 404
        assert "not found" in res_fake_insp.json()["detail"].lower()
        print("✓ Non-existent Inspection ID Gracefully Rejected (404 Not Found)")

        # --- TEST 24: Valid Status Lifecycle Progression & History Logging ---
        print("\n--- TEST 24: Valid Status Lifecycle Progression (Open -> Assigned -> In Progress -> Completed) ---")
        # Step A: Open -> Assigned
        res_step_a = client.patch(
            f"/api/v1/maintenance/{wo_id_manual}/status",
            json={"status": "Assigned", "notes": "Assigned to Alpha Patch Squad"}
        )
        assert res_step_a.status_code == 200
        assert res_step_a.json()["status"] == "Assigned"

        # Step B: Assigned -> In Progress
        res_step_b = client.patch(
            f"/api/v1/maintenance/{wo_id_manual}/status",
            json={"status": "In Progress", "notes": "Crew arrived on site, asphalt milling started"}
        )
        assert res_step_b.status_code == 200
        assert res_step_b.json()["status"] == "In Progress"

        # Step C: In Progress -> Completed
        res_step_c = client.patch(
            f"/api/v1/maintenance/{wo_id_manual}/status",
            json={
                "status": "Completed",
                "notes": "Pothole filled with polymer hot mix and roller compacted",
                "actual_cost": "₹15,800",
                "completion_notes": "Passed surface levelness inspection"
            }
        )
        assert res_step_c.status_code == 200
        completed_data = res_step_c.json()
        assert completed_data["status"] == "Completed"
        assert completed_data["actual_cost"] == "₹15,800"
        assert completed_data["completion_details"] is not None
        assert completed_data["completion_details"]["completed_at"] is not None
        # Verify status history audit trail has 4 logged records
        assert len(completed_data["status_history"]) == 4
        print(f"✓ Full Lifecycle Successfully Completed for {wo_id_manual} with 4 Audit Entries")

        # --- TEST 25: Prevention of Invalid Status Transitions ---
        print("\n--- TEST 25: Prevention of Invalid Status Transitions ---")
        # Attempt to transition Completed work order back to Open
        res_invalid_trans = client.patch(
            f"/api/v1/maintenance/{wo_id_manual}/status",
            json={"status": "Open", "notes": "Illegal backward transition"}
        )
        assert res_invalid_trans.status_code == 400
        assert "invalid status transition" in res_invalid_trans.json()["detail"].lower()
        print("✓ Completed -> Open Transition Rejected with 400 Bad Request")

        # Cancel a work order and verify Cancelled cannot transition to In Progress
        res_cancel = client.patch(
            f"/api/v1/maintenance/{wo_id_linked}/status",
            json={"status": "Cancelled", "notes": "Duplicate ticket merged"}
        )
        assert res_cancel.status_code == 200
        assert res_cancel.json()["status"] == "Cancelled"

        res_invalid_cancel_trans = client.patch(
            f"/api/v1/maintenance/{wo_id_linked}/status",
            json={"status": "In Progress", "notes": "Cannot restart cancelled ticket"}
        )
        assert res_invalid_cancel_trans.status_code == 400
        print("✓ Cancelled -> In Progress Transition Rejected with 400 Bad Request")

        # --- TEST 26: Work Order Detail Updates (Team Assignment & Priority) ---
        print("\n--- TEST 26: Work Order Detail Updates ---")
        # Create a fresh order for detail editing
        res_edit_order = client.post(
            "/api/v1/maintenance",
            json={"road_name": "Outer Ring Road Sector 9", "priority": "Low", "description": "Minor crack"}
        )
        wo_edit_id = res_edit_order.json()["work_order_id"]

        patch_details_res = client.patch(
            f"/api/v1/maintenance/{wo_edit_id}",
            json={
                "priority": "Critical",
                "assigned_team": "Rapid Response Unit",
                "description": "Crack expanded significantly after rain, urgent seal required",
                "target_completion_date": "2026-11-01"
            }
        )
        assert patch_details_res.status_code == 200
        patched_data = patch_details_res.json()
        assert patched_data["priority"] == "Critical"
        assert patched_data["assigned_team"] == "Rapid Response Unit"
        assert patched_data["target_completion_date"] == "2026-11-01"
        assert patched_data["status"] == "Assigned"  # Auto-transitioned from Open upon crew assignment
        print(f"✓ Work Order {wo_edit_id} Details Updated & Auto-Assigned Successfully")

        # --- TEST 27: Maintenance Statistics Aggregation from Real MongoDB Documents ---
        print("\n--- TEST 27: Maintenance Statistics Aggregation ---")
        maint_stats_res = client.get("/api/v1/maintenance/statistics")
        assert maint_stats_res.status_code == 200
        maint_stats = maint_stats_res.json()
        assert maint_stats["total_work_orders"] >= 3
        assert maint_stats["completed_work_orders"] >= 1
        assert maint_stats["cancelled_work_orders"] >= 1
        assert maint_stats["total_estimated_cost_val"] > 0
        assert "formatted_total_estimated_cost" in maint_stats
        assert "priority_distribution" in maint_stats
        assert "status_distribution" in maint_stats
        print(f"✓ Live Maintenance Stats Verified: {maint_stats['total_work_orders']} orders, {maint_stats['completed_work_orders']} completed, {maint_stats['formatted_total_estimated_cost']} est cost")

        # --- TEST 28: Maintenance Filtering by Status, Priority, Category, and Team ---
        print("\n--- TEST 28: Maintenance Work Orders Filtering ---")
        # Filter by status=Completed
        completed_filter_res = client.get("/api/v1/maintenance?status=Completed")
        assert completed_filter_res.status_code == 200
        for item in completed_filter_res.json():
            assert item["status"] == "Completed"
        print(f"✓ Filter by status=Completed: {len(completed_filter_res.json())} orders")

        # Filter by priority=Critical
        crit_filter_res = client.get("/api/v1/maintenance?priority=Critical")
        assert crit_filter_res.status_code == 200
        for item in crit_filter_res.json():
            assert item["priority"].lower() == "critical"
        print(f"✓ Filter by priority=Critical: {len(crit_filter_res.json())} orders")

        # Filter by team=Rapid Response Unit
        team_filter_res = client.get("/api/v1/maintenance?team=Rapid Response Unit")
        assert team_filter_res.status_code == 200
        for item in team_filter_res.json():
            assert item["assigned_team"] == "Rapid Response Unit"
        print(f"✓ Filter by team=Rapid Response Unit: {len(team_filter_res.json())} orders")

        # --- TEST 29: Image Inspection PDF Report Generation ---
        print("\n--- TEST 29: Image Inspection PDF Report Generation ---")
        history_items = client.get("/api/v1/detect/history?limit=10").json()["items"]
        img_records = [it for it in history_items if it.get("media_type") != "video" and not it.get("video_metadata")]
        assert len(img_records) > 0, "No image inspection records found for PDF test"
        test_img_id = img_records[0].get("detection_id") or img_records[0].get("id")
        
        pdf_img_res = client.get(f"/api/v1/reports/inspection/{test_img_id}")
        assert pdf_img_res.status_code == 200
        assert pdf_img_res.headers.get("content-type") == "application/pdf"
        assert pdf_img_res.content.startswith(b"%PDF")
        assert len(pdf_img_res.content) > 1000
        assert "attachment" in pdf_img_res.headers.get("content-disposition", "")
        print(f"✓ Image Inspection PDF Generated: {len(pdf_img_res.content)} bytes, Valid %PDF magic header")

        # --- TEST 30: Video Inspection PDF Report Generation ---
        print("\n--- TEST 30: Video Inspection PDF Report Generation ---")
        vid_records = [it for it in history_items if it.get("media_type") == "video" or it.get("video_metadata")]
        assert len(vid_records) > 0, "No video inspection records found for PDF test"
        test_vid_id = vid_records[0].get("detection_id") or vid_records[0].get("id")

        pdf_vid_res = client.get(f"/api/v1/reports/inspection/{test_vid_id}")
        assert pdf_vid_res.status_code == 200
        assert pdf_vid_res.headers.get("content-type") == "application/pdf"
        assert pdf_vid_res.content.startswith(b"%PDF")
        assert len(pdf_vid_res.content) > 1000
        print(f"✓ Video Inspection PDF Generated: {len(pdf_vid_res.content)} bytes, Valid %PDF magic header")

        # --- TEST 31: Executive Summary PDF Report (All-Time) ---
        print("\n--- TEST 31: Executive Summary PDF Report (All-Time) ---")
        pdf_sum_res = client.get("/api/v1/reports/summary")
        assert pdf_sum_res.status_code == 200
        assert pdf_sum_res.headers.get("content-type") == "application/pdf"
        assert pdf_sum_res.content.startswith(b"%PDF")
        assert len(pdf_sum_res.content) > 1000
        assert "Wayzo-Summary-Report" in pdf_sum_res.headers.get("content-disposition", "")
        print(f"✓ Executive Summary PDF Generated: {len(pdf_sum_res.content)} bytes, Valid %PDF magic header")

        # --- TEST 32: Executive Summary PDF with Date Range Filter ---
        print("\n--- TEST 32: Executive Summary PDF with Date Range Filter ---")
        pdf_filtered_res = client.get("/api/v1/reports/summary?start_date=2026-01-01&end_date=2026-12-31")
        assert pdf_filtered_res.status_code == 200
        assert pdf_filtered_res.headers.get("content-type") == "application/pdf"
        assert pdf_filtered_res.content.startswith(b"%PDF")
        print(f"✓ Date-Filtered Summary PDF Generated: {len(pdf_filtered_res.content)} bytes")

        # --- TEST 33: Invalid Date Format Handling (400 Bad Request) ---
        print("\n--- TEST 33: Invalid Date Format Handling (400 Bad Request) ---")
        invalid_date_res = client.get("/api/v1/reports/summary?start_date=2026/01/01")
        assert invalid_date_res.status_code == 400
        assert "YYYY-MM-DD" in invalid_date_res.json()["detail"]
        print("✓ Invalid Date Format Gracefully Handled (400 Bad Request with format instructions)")

        # --- TEST 34: Non-existent Inspection ID Handling (404 Not Found) ---
        print("\n--- TEST 34: Non-existent Inspection ID Handling (404 Not Found) ---")
        non_existent_pdf_res = client.get("/api/v1/reports/inspection/DET-NONEXISTENT-9999")
        assert non_existent_pdf_res.status_code == 404
        assert "not found" in non_existent_pdf_res.json()["detail"].lower()
        print("✓ Non-existent Inspection PDF Request Gracefully Rejected (404 Not Found)")

    # Cleanup temporary test files
    for temp in [valid_img_path, invalid_ext_path, corrupt_img_path, corrupt_vid_path, valid_vid_path]:
        if temp.exists():
            try:
                temp.unlink()
            except OSError:
                pass

    print("\n" + "=" * 60)
    print("ALL 34 TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

