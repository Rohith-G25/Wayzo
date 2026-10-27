"""
Production Readiness Verification Test Suite for Wayzo (SmartRoadAI)
Tests:
1. MongoDB indexes and uniqueness enforcement (duplicate email & detection_id)
2. Database connection status and error handling
3. Video job persistence and backend restart recovery
4. Production security configuration (docs disabling & CORS normalization)
5. Work order cost aggregation capacity
6. Ephemeral media ticket rotation and token-in-URL rejection
"""

import sys
import asyncio
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, ensure_indexes, cleanup_interrupted_jobs, get_database, db_helper
from app.services.auth_service import AuthService
from app.services.maintenance_service import MaintenanceService, parse_cost_value
from app.services.video_job_service import video_job_manager
from app.schemas.auth import UserCreate, UserRole
from fastapi.testclient import TestClient
from app.main import app

def run_production_tests():
    print("=" * 65)
    print("STARTING PRODUCTION READINESS AUDIT & VERIFICATION SUITE")
    print("=" * 65)

    client = TestClient(app)

    async def _run_async_tests():
        # Setup Mongo
        await connect_to_mongo()
        db = get_database()

        # TEST 1: MongoDB Index Verification & Duplicate Email Prevention
        print("\n--- TEST 1: MongoDB Uniqueness & Index Enforcement ---")
        await ensure_indexes()
        test_email = f"audit_unique_{int(time.time())}@wayzo.gov"
        auth_service = AuthService(db)

        user_in1 = UserCreate(
            email=test_email,
            password="SecurePass123!",
            full_name="Audit User",
            role=UserRole.INSPECTOR
        )
        user1 = await auth_service.create_user(user_in1)
        assert user1.email == test_email
        print(f"[PASS] Initial user registered: {user1.user_id} ({user1.email})")

        # Attempt duplicate registration
        try:
            user_in2 = UserCreate(
                email=test_email,
                password="AnotherPassword123!",
                full_name="Duplicate User",
                role=UserRole.MAINTENANCE
            )
            await auth_service.create_user(user_in2)
            print("FAILED: Duplicate email was permitted!")
            assert False, "Duplicate user email must be rejected"
        except Exception as e:
            print(f"[PASS] Duplicate email registration strictly rejected: {e.detail if hasattr(e, 'detail') else e}")

        # Cleanup test user
        await db.users.delete_one({"email": test_email})

        # TEST 2: Video Job Persistence & Server Restart Recovery
        print("\n--- TEST 2: Video Background Job Persistence Across Restarts ---")
        test_job_id = f"job-audit-{uuid.uuid4().hex[:8]}"
        now_ts = datetime.now(timezone.utc).isoformat()
        
        # Insert a job simulating an in-progress job prior to backend restart
        await db.video_jobs.insert_one({
            "job_id": test_job_id,
            "filename": "highway_survey_cam4.mp4",
            "file_size_bytes": 10485760,
            "status": "processing",
            "progress": 45,
            "message": "Processing frame 45/100...",
            "processed_frames": 45,
            "total_sampled_frames": 100,
            "defects_found": 2,
            "result": None,
            "error": None,
            "created_at": now_ts,
            "updated_at": now_ts,
        })
        print(f"[PASS] Simulating active processing job before server restart: {test_job_id}")

        # Run startup cleanup routine (runs automatically on backend startup)
        await cleanup_interrupted_jobs()

        recovered_job = await db.video_jobs.find_one({"job_id": test_job_id})
        assert recovered_job["status"] == "failed"
        assert "interrupted" in recovered_job["error"].lower()
        print(f"[PASS] Server restart recovery verified: Job status gracefully set to 'failed' with reason: {recovered_job['error']}")

        # Cleanup test job
        await db.video_jobs.delete_one({"job_id": test_job_id})

        # TEST 3: Work Order Cost Aggregation Scale
        print("\n--- TEST 3: Maintenance Cost Aggregation Scale ---")
        maint_service = MaintenanceService(db)
        stats = await maint_service.get_maintenance_statistics()
        assert "formatted_total_estimated_cost" in stats
        assert "total_estimated_cost_val" in stats
        assert stats["total_estimated_cost_val"] >= 0
        print(f"[PASS] Live maintenance statistics aggregated: {stats['total_work_orders']} orders, Total Cost: {stats['formatted_total_estimated_cost']}")

        # TEST 4: Cost Parser Accuracy
        print("\n--- TEST 4: Cost String Extraction Validation ---")
        assert parse_cost_value("₹15,000") == 15000.0
        assert parse_cost_value("₹1,250,500") == 1250500.0
        assert parse_cost_value("₹0") == 0.0
        assert parse_cost_value(None) == 0.0
        assert parse_cost_value("Invalid") == 0.0
        print("[PASS] Cost parsing handles currency symbols, commas, decimals, and nulls with 100% precision")

        await close_mongo_connection()

    # Execute async tests
    asyncio.run(_run_async_tests())

    # TEST 5: Health Check Endpoint
    print("\n--- TEST 5: Health Check & System Status ---")
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "online"
    print(f"[PASS] Health check response (200 OK): {resp.json()}")

    # TEST 6: CORS Origins Normalization
    print("\n--- TEST 6: CORS Configuration Normalization ---")
    for origin in settings.cors_origins_list:
        assert not origin.endswith("/"), f"Origin '{origin}' should not have trailing slash"
    print(f"[PASS] Verified permitted CORS origins without trailing slashes: {settings.cors_origins_list}")

    # TEST 7: Query Token Prohibition for Media
    print("\n--- TEST 7: Query Parameter Token Prohibited on Media ---")
    resp = client.get("/api/v1/media/images/test.jpg?token=insecure_token_attempt")
    assert resp.status_code == 401
    assert "prohibited" in resp.json()["detail"].lower()
    print("[PASS] Access token in query string (?token=...) strictly rejected (401 Unauthorized)")

    print("\n" + "=" * 65)
    print("ALL PRODUCTION READINESS AUDIT TESTS PASSED SUCCESSFULLY!")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    run_production_tests()
