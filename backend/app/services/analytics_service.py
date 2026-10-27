from typing import Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.detection_service import DetectionService

def normalize_defect_category(raw_name: str) -> str:
    """Normalize raw defect class names to standardized reporting categories."""
    if not raw_name:
        return "Unknown Defect"
    c_low = raw_name.lower().strip()
    if "pothole" in c_low:
        return "Pothole"
    elif "alligator" in c_low:
        return "Alligator Crack"
    elif "longitudinal" in c_low:
        return "Longitudinal Crack"
    elif "transverse" in c_low:
        return "Transverse Crack"
    elif "crack" in c_low:
        return "General Crack"
    return raw_name.replace("_", " ").title()

class AnalyticsService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_system_statistics(self) -> Dict[str, Any]:
        """
        Dynamically aggregate statistics across detections, maintenance,
        and camera collections to build the live dashboard and analytics payload.
        Never fabricates records or returns mock statistics.
        """
        # 1. Total inspection sessions count (uploads/runs)
        total_inspections = await self.db.detections.count_documents({})
        
        # 2. Camera count
        camera_count = await self.db.cameras.count_documents({})
        
        # 3. Maintenance work order counts (active repair queue vs completed)
        repairs_pending = await self.db.maintenance.count_documents({"status": {"$nin": ["Completed", "Cancelled"]}})
        repairs_completed = await self.db.maintenance.count_documents({"status": "Completed"})
        
        # 4. Defect Category and Severity Dynamic Aggregation
        total_defects = 0
        critical_count = 0
        high_count = 0
        medium_count = 0
        low_count = 0
        pothole_count = 0
        crack_count = 0
        category_distribution: Dict[str, int] = {}
        
        defect_pipeline = [
            {"$unwind": "$detections"},
            {
                "$group": {
                    "_id": {
                        "category": "$detections.class",
                        "severity": "$detections.severity"
                    },
                    "count": {"$sum": 1}
                }
            }
        ]
        
        try:
            defect_groups = await self.db.detections.aggregate(defect_pipeline).to_list(length=500)
            for group in defect_groups:
                raw_cat = group["_id"].get("category", "")
                sev = group["_id"].get("severity", "Medium")
                count = group.get("count", 0)
                
                total_defects += count
                
                # Severity tally without double-counting
                if sev == "Critical":
                    critical_count += count
                elif sev == "High":
                    high_count += count
                elif sev == "Medium":
                    medium_count += count
                elif sev == "Low":
                    low_count += count
                else:
                    medium_count += count

                # Normalized category tally
                norm_cat = normalize_defect_category(raw_cat)
                category_distribution[norm_cat] = category_distribution.get(norm_cat, 0) + count
                
                # Specific pothole vs crack tallies
                if "pothole" in raw_cat.lower():
                    pothole_count += count
                elif "crack" in raw_cat.lower():
                    crack_count += count
        except Exception:
            pass

        severity_distribution = {
            "Critical": critical_count,
            "High": high_count,
            "Medium": medium_count,
            "Low": low_count
        }

        # 5. Inspection Trends Over Time (Group by YYYY-MM-DD from timestamp)
        inspection_trends: List[Dict[str, Any]] = []
        trend_pipeline = [
            {
                "$project": {
                    "date": {"$substr": [{"$ifNull": ["$timestamp", ""]}, 0, 10]},
                    "defects_count": {"$size": {"$ifNull": ["$detections", []]}}
                }
            },
            {
                "$match": {
                    "date": {"$regex": r"^\d{4}-\d{2}-\d{2}$"}
                }
            },
            {
                "$group": {
                    "_id": "$date",
                    "inspections": {"$sum": 1},
                    "defects": {"$sum": "$defects_count"}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        try:
            trend_results = await self.db.detections.aggregate(trend_pipeline).to_list(length=100)
            for res in trend_results:
                inspection_trends.append({
                    "date": res["_id"],
                    "inspections": res.get("inspections", 0),
                    "defects": res.get("defects", 0)
                })
        except Exception:
            pass

        # 6. Check System Health
        mongo_ok = False
        try:
            await self.db.command("ping")
            mongo_ok = True
        except Exception:
            pass
            
        yolo_ok = DetectionService._model is not None
        
        if mongo_ok and yolo_ok:
            system_health = "Healthy"
        elif mongo_ok or yolo_ok:
            system_health = "Degraded"
        else:
            system_health = "Unhealthy"

        return {
            # Backward-compatible fields
            "totalDetections": total_defects,
            "highSeverity": critical_count + high_count,
            "mediumSeverity": medium_count,
            "lowSeverity": low_count,
            "repairsPending": repairs_pending,
            "repairsCompleted": repairs_completed,
            "cameraCount": camera_count,
            "systemHealth": system_health,

            # Granular real inspection & defect metrics
            "totalInspections": total_inspections,
            "totalDefects": total_defects,
            "potholeCount": pothole_count,
            "crackCount": crack_count,
            "criticalCount": critical_count,
            "categoryDistribution": category_distribution,
            "severityDistribution": severity_distribution,
            "inspectionTrends": inspection_trends
        }
