import logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from app.config import settings

logger = logging.getLogger("smartroadai.database")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_helper = Database()

def get_database():
    """Retrieve database instance."""
    if db_helper.db is None:
        if db_helper.client is not None:
            db_helper.db = db_helper.client[settings.DATABASE_NAME]
            return db_helper.db
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service unavailable. Please ensure MongoDB is running."
        )
    return db_helper.db

async def connect_to_mongo():
    """Connect to MongoDB and ping to verify connectivity."""
    logger.info("Connecting to MongoDB...")
    try:
        db_helper.client = AsyncIOMotorClient(settings.MONGODB_URI)
        db_helper.db = db_helper.client[settings.DATABASE_NAME]
        # Ping database to verify connection
        await db_helper.db.command("ping")
        logger.info("Successfully connected to MongoDB!")
        await seed_database()
        await ensure_indexes()
        await cleanup_interrupted_jobs()
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        # Keep client instance for lazy reconnects or fail gracefully
        db_helper.db = None

async def close_mongo_connection():
    """Close MongoDB connection."""
    if db_helper.client:
        logger.info("Closing MongoDB connection...")
        db_helper.client.close()
        logger.info("MongoDB connection closed.")

async def ensure_indexes():
    """Ensure essential indexes for data integrity, uniqueness, and fast query execution."""
    db = db_helper.db
    if db is None:
        return
    try:
        # Users: unique constraints
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)

        # Detections: unique detection_id, reverse chronological pagination
        await db.detections.create_index("detection_id", unique=True)
        await db.detections.create_index([("timestamp", -1)])
        await db.detections.create_index([("media_type", 1), ("timestamp", -1)])
        await db.detections.create_index("work_order_id")

        # Maintenance: unique work_order_id (sparse for legacy tickets), query indexes
        await db.maintenance.create_index("work_order_id", unique=True, sparse=True)
        await db.maintenance.create_index([("status", 1), ("created_at", -1)])
        await db.maintenance.create_index([("priority", 1), ("created_at", -1)])
        await db.maintenance.create_index("detection_id")

        # Video jobs: unique job_id and chronological index
        await db.video_jobs.create_index("job_id", unique=True)
        await db.video_jobs.create_index([("created_at", -1)])

        # Revoked tokens: automatic TTL cleanup (7 days)
        await db.revoked_tokens.create_index("revoked_at", expireAfterSeconds=60 * 60 * 24 * 7)
        logger.info("MongoDB database indexes ensured successfully.")
    except Exception as e:
        logger.warning(f"Note on MongoDB index verification: {e}")

async def cleanup_interrupted_jobs():
    """Mark any video jobs that were in progress when the backend restarted as interrupted."""
    db = db_helper.db
    if db is None:
        return
    try:
        res = await db.video_jobs.update_many(
            {"status": {"$in": ["queued", "processing"]}},
            {"$set": {
                "status": "failed",
                "error": "Job interrupted due to backend process restart. Please re-run inspection.",
                "message": "Inspection interrupted by backend restart."
            }}
        )
        if res.modified_count > 0:
            logger.info(f"Cleaned up {res.modified_count} interrupted video jobs from previous server run.")
    except Exception as e:
        logger.warning(f"Could not check interrupted video jobs: {e}")

async def seed_database():
    """Seed default collections if empty to provide immediate functionality."""
    db = db_helper.db
    
    # 1. Cameras Seeding
    if await db.cameras.count_documents({}) == 0:
        logger.info("Seeding default camera data...")
        await db.cameras.insert_many([
            {
                "camera_id": "CAM-101",
                "location": "Inner Ring Road, Block B",
                "gps": {"latitude": 28.6139, "longitude": 77.2090},
                "status": "Active",
                "last_ping": datetime.now(timezone.utc).isoformat()
            },
            {
                "camera_id": "CAM-102",
                "location": "NH-8 Highway, Mile 23",
                "gps": {"latitude": 28.5355, "longitude": 77.3910},
                "status": "Active",
                "last_ping": datetime.now(timezone.utc).isoformat()
            },
            {
                "camera_id": "CAM-103",
                "location": "Sector 62 Flyover Junction",
                "gps": {"latitude": 28.6282, "longitude": 77.3898},
                "status": "Maintenance",
                "last_ping": datetime.now(timezone.utc).isoformat()
            },
            {
                "camera_id": "CAM-104",
                "location": "Outer Ring Road Exit 4",
                "gps": {"latitude": 28.5272, "longitude": 77.0689},
                "status": "Inactive",
                "last_ping": datetime.now(timezone.utc).isoformat()
            }
        ])

    # 2. Hospitals Seeding
    if await db.hospitals.count_documents({}) == 0:
        logger.info("Seeding default hospital database...")
        await db.hospitals.insert_many([
            {
                "name": "Metro Trauma & General Hospital",
                "latitude": 28.6200,
                "longitude": 77.2200,
                "contact": "+91-11-4578900",
                "ambulance_status": "Available"
            },
            {
                "name": "City Emergency Care Center",
                "latitude": 28.5450,
                "longitude": 77.4000,
                "contact": "+91-11-2365447",
                "ambulance_status": "Dispatched"
            },
            {
                "name": "Apex Specialty Hospital",
                "latitude": 28.6320,
                "longitude": 77.3750,
                "contact": "+91-11-9876543",
                "ambulance_status": "Available"
            },
            {
                "name": "Apollo Emergency Response Unit",
                "latitude": 28.5200,
                "longitude": 77.0800,
                "contact": "+91-11-8889999",
                "ambulance_status": "Available"
            }
        ])

    # 3. Alerts Seeding
    if await db.alerts.count_documents({}) == 0:
        logger.info("Seeding default alerts...")
        await db.alerts.insert_many([
            {
                "alert_id": "ALT-001",
                "type": "Critical Damage",
                "description": "Large cluster of pothole damage detected on Lane 1 of Inner Ring Road.",
                "location": "Inner Ring Road, Block B",
                "gps": {"latitude": 28.6139, "longitude": 77.2090},
                "severity": "Critical",
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "alert_id": "ALT-002",
                "type": "Road Hazard",
                "description": "Loose asphalt debris reported near flyover structure.",
                "location": "Sector 62 Flyover Junction",
                "gps": {"latitude": 28.6282, "longitude": 77.3898},
                "severity": "Medium",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        ])

    # 4. Detections and Maintenance Mock Seeding for full UI rendering
    if await db.detections.count_documents({}) == 0:
        logger.info("Seeding default historical detections...")
        det_id_1 = "DET-901"
        await db.detections.insert_one({
            "detection_id": det_id_1,
            "filename": "mock_pothole_1.jpg",
            "gps": {"latitude": 28.6139, "longitude": 77.2090},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detections": [
                {
                    "class": "pothole",
                    "confidence": 0.96,
                    "severity": "High",
                    "bounding_box": [120, 340, 280, 490],
                    "estimated_cost": "₹15000"
                }
            ],
            "processing_time": "0.145s",
            "success": True
        })
        
        if await db.maintenance.count_documents({}) == 0:
            logger.info("Seeding default maintenance tickets...")
            await db.maintenance.insert_one({
                "ticket_id": "MNT-201",
                "priority": "High",
                "road_name": "Inner Ring Road, Block B",
                "gps": {"latitude": 28.6139, "longitude": 77.2090},
                "estimated_cost": "₹15000",
                "status": "Pending",
                "detection_id": det_id_1,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
