import uuid
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.maintenance import (
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderStatusUpdate,
    WorkOrderUpdate,
    MaintenanceStatisticsResponse,
    StatusHistoryItem,
    CompletionDetails,
    GPSCoordinate
)
from app.utils.gps import validate_coordinates

# Strict state transition workflow
VALID_TRANSITIONS = {
    "Open": ["Assigned", "Cancelled"],
    "Assigned": ["In Progress", "Open", "Cancelled"],
    "In Progress": ["Completed", "Assigned", "Cancelled"],
    "Completed": [],  # Terminal state
    "Cancelled": [],  # Terminal state
    # Backward compatibility mappings for older seeded / legacy tickets
    "Pending": ["Assigned", "In Progress", "Cancelled", "Open"],
    "Scheduled": ["In Progress", "Open", "Cancelled", "Assigned"],
    "Pending Triage": ["Assigned", "In Progress", "Cancelled", "Open"]
}

SEVERITY_DISCLAIMER = (
    "Heuristic calculation based on bounding-box surface area and model confidence; "
    "not a certified civil/pavement engineering assessment."
)

COST_DISCLAIMER = (
    "Automated cost estimate based on detected damage geometry; subject to field contractor assessment."
)

def parse_cost_value(cost_str: Optional[str]) -> float:
    """Extract numeric value from cost string (e.g. '₹15,000' -> 15000.0)."""
    if not cost_str:
        return 0.0
    digits = re.sub(r"[^\d.]", "", str(cost_str))
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0

class MaintenanceService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    def _normalize_status(self, raw_status: Optional[str]) -> str:
        """Map legacy or draft statuses to standard workflow statuses."""
        if not raw_status:
            return "Open"
        s = raw_status.strip()
        if s.lower() in ["pending", "pending triage", "new"]:
            return "Open"
        if s.lower() in ["scheduled"]:
            return "Assigned"
        return s

    async def create_work_order(self, order_data: WorkOrderCreate) -> Dict[str, Any]:
        """
        Create a trackable maintenance work order.
        If an inspection_id is supplied, verify it against actual MongoDB records
        to ensure genuine coordinates, verified defects, and authentic damage classifications.
        """
        work_order_id = f"WO-{uuid.uuid4().hex[:8].upper()}"
        now_iso = datetime.now(timezone.utc).isoformat()
        
        gps_dict = None
        gps_source = None
        damage_cat = order_data.damage_category
        severity_val = order_data.priority or "Medium"
        est_cost = order_data.estimated_cost or "₹15000"
        image_url = None
        defect_info = order_data.defect_info
        road_name = order_data.road_name or "Unspecified Roadway Corridor"
        
        # 1. Verification against genuine inspection record if linked
        if order_data.inspection_id:
            insp = await self.db.detections.find_one({"detection_id": order_data.inspection_id})
            if not insp:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Inspection record '{order_data.inspection_id}' not found in database."
                )
            
            # Extract genuine GPS (never invent coordinates)
            raw_lat = insp.get("latitude")
            raw_lon = insp.get("longitude")
            if raw_lat is None or raw_lon is None:
                gps_sub = insp.get("gps")
                if isinstance(gps_sub, dict):
                    raw_lat = gps_sub.get("latitude")
                    raw_lon = gps_sub.get("longitude")
            
            validated = validate_coordinates(raw_lat, raw_lon)
            if validated:
                gps_dict = {
                    "latitude": validated[0],
                    "longitude": validated[1],
                    "source": insp.get("gps_source") or (insp.get("gps", {}).get("source") if isinstance(insp.get("gps"), dict) else "stored")
                }
                gps_source = gps_dict["source"]
            
            # Extract genuine defect classification
            detections = insp.get("detections", [])
            if detections and not damage_cat:
                top_det = detections[0]
                damage_cat = top_det.get("class") or top_det.get("category") or "Road Damage"
                if not defect_info:
                    defect_info = top_det
            elif not damage_cat:
                damage_cat = "Road Surface Defect"

            if insp.get("highest_severity") and insp.get("highest_severity") != "None":
                severity_val = insp.get("highest_severity")
            
            if insp.get("estimated_cost") and not order_data.estimated_cost:
                est_cost = insp.get("estimated_cost")

            img_path = insp.get("processed_image_path") or insp.get("preview_image_url") or insp.get("image_url")
            if img_path:
                image_url = str(img_path).replace("\\", "/")

        else:
            # Standalone manual work order: validate coordinates if explicitly supplied
            if order_data.latitude is not None and order_data.longitude is not None:
                validated = validate_coordinates(order_data.latitude, order_data.longitude)
                if validated:
                    gps_dict = {
                        "latitude": validated[0],
                        "longitude": validated[1],
                        "source": "manual"
                    }
                    gps_source = "manual"

        # Initial status calculation
        initial_status = self._normalize_status(order_data.status)
        if order_data.assigned_team and initial_status == "Open":
            initial_status = "Assigned"

        # Generate default repair description if not provided
        description = order_data.description
        if not description:
            description = f"Repair and resurface {damage_cat or 'damaged section'} on {road_name}. Priority: {severity_val}."

        doc = {
            "work_order_id": work_order_id,
            "ticket_id": work_order_id,  # backward compatibility alias
            "inspection_id": order_data.inspection_id,
            "detection_id": order_data.inspection_id,
            "road_name": road_name,
            "description": description,
            "priority": severity_val,
            "status": initial_status,
            "damage_category": damage_cat or "Road Damage",
            "defect_info": defect_info,
            "severity_estimate": severity_val,
            "estimated_cost": est_cost,
            "actual_cost": None,
            "assigned_team": order_data.assigned_team,
            "gps": gps_dict,
            "gps_source": gps_source,
            "image_url": image_url,
            "target_completion_date": order_data.target_completion_date,
            "created_at": now_iso,
            "updated_at": now_iso,
            "status_history": [
                {
                    "from_status": None,
                    "to_status": initial_status,
                    "changed_at": now_iso,
                    "notes": order_data.initial_notes or f"Work order created with status '{initial_status}'"
                }
            ],
            "completion_details": None,
            "severity_disclaimer": SEVERITY_DISCLAIMER,
            "cost_disclaimer": COST_DISCLAIMER
        }

        await self.db.maintenance.insert_one(doc)

        # Update linked inspection in db.detections
        if order_data.inspection_id:
            await self.db.detections.update_one(
                {"detection_id": order_data.inspection_id},
                {
                    "$set": {
                        "work_order_id": work_order_id,
                        "work_order_status": initial_status
                    }
                }
            )

        return doc

    # Legacy method compatibility
    async def create_ticket(self, ticket: WorkOrderCreate) -> Dict[str, Any]:
        """Manually create a maintenance ticket (backward-compatible)."""
        return await self.create_work_order(ticket)

    async def create_automatic_ticket(
        self, 
        priority: str, 
        road_name: str, 
        latitude: Optional[float], 
        longitude: Optional[float], 
        estimated_cost: str, 
        detection_id: str
    ) -> Dict[str, Any]:
        """Automatically create a work order linked to an AI detection session."""
        wo_create = WorkOrderCreate(
            inspection_id=detection_id,
            road_name=road_name,
            priority=priority,
            estimated_cost=estimated_cost,
            latitude=latitude,
            longitude=longitude,
            initial_notes="Automatically triggered from AI road damage detection session"
        )
        return await self.create_work_order(wo_create)

    async def get_work_orders(
        self,
        status_filter: Optional[str] = "all",
        priority_filter: Optional[str] = "all",
        category_filter: Optional[str] = "all",
        team_filter: Optional[str] = "all",
        limit: int = 200,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Retrieve maintenance work orders with dynamic filtering."""
        query: Dict[str, Any] = {}

        if status_filter and status_filter.lower() != "all":
            s_low = status_filter.lower()
            if s_low == "open":
                query["status"] = {"$in": ["Open", "Pending", "Pending Triage"]}
            elif s_low == "assigned":
                query["status"] = {"$in": ["Assigned", "Scheduled"]}
            elif s_low == "in progress":
                query["status"] = "In Progress"
            elif s_low == "completed":
                query["status"] = "Completed"
            elif s_low == "cancelled":
                query["status"] = "Cancelled"
            else:
                query["status"] = status_filter

        if priority_filter and priority_filter.lower() != "all":
            query["priority"] = {"$regex": f"^{priority_filter}$", "$options": "i"}

        if category_filter and category_filter.lower() != "all":
            query["damage_category"] = {"$regex": f"^{category_filter}$", "$options": "i"}

        if team_filter and team_filter.lower() != "all":
            if team_filter.lower() == "unassigned":
                query["$or"] = [{"assigned_team": None}, {"assigned_team": ""}]
            else:
                query["assigned_team"] = team_filter

        cursor = self.db.maintenance.find(query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        
        # Ensure consistent schema mapping for legacy docs
        sanitized = []
        for doc in docs:
            wo_id = doc.get("work_order_id") or doc.get("ticket_id") or f"WO-{str(doc.get('_id', ''))[:8].upper()}"
            doc["work_order_id"] = wo_id
            doc["ticket_id"] = wo_id
            doc["status"] = self._normalize_status(doc.get("status"))
            doc["description"] = doc.get("description") or f"Repair on {doc.get('road_name', 'Road')}"
            doc["severity_disclaimer"] = SEVERITY_DISCLAIMER
            doc["cost_disclaimer"] = COST_DISCLAIMER
            sanitized.append(doc)
        return sanitized

    async def get_tickets(self) -> List[Dict[str, Any]]:
        """Retrieve all maintenance tickets (backward-compatible)."""
        return await self.get_work_orders(limit=1000)

    async def get_work_order_by_id(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific work order by work_order_id or ticket_id."""
        doc = await self.db.maintenance.find_one({
            "$or": [{"work_order_id": order_id}, {"ticket_id": order_id}]
        })
        if not doc:
            return None
        wo_id = doc.get("work_order_id") or doc.get("ticket_id")
        doc["work_order_id"] = wo_id
        doc["ticket_id"] = wo_id
        doc["status"] = self._normalize_status(doc.get("status"))
        doc["severity_disclaimer"] = SEVERITY_DISCLAIMER
        doc["cost_disclaimer"] = COST_DISCLAIMER
        return doc

    async def update_work_order_status(
        self, 
        order_id: str, 
        update: WorkOrderStatusUpdate
    ) -> Dict[str, Any]:
        """
        Validate and execute a work order status lifecycle transition.
        Records transition history and enforces terminal states.
        """
        doc = await self.get_work_order_by_id(order_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Work order '{order_id}' not found."
            )

        current_status = self._normalize_status(doc.get("status"))
        target_status = update.status.strip()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Check validity of transition
        allowed = VALID_TRANSITIONS.get(current_status, [])
        if target_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from '{current_status}' to '{target_status}'. Allowed next transitions: {allowed if allowed else 'None (Terminal State)'}."
            )

        # Build update document
        history_entry = {
            "from_status": current_status,
            "to_status": target_status,
            "changed_at": now_iso,
            "notes": update.notes or f"Status changed from {current_status} to {target_status}"
        }

        update_fields: Dict[str, Any] = {
            "status": target_status,
            "updated_at": now_iso
        }

        if target_status == "Completed":
            completion_details = {
                "completed_at": now_iso,
                "completion_notes": update.completion_notes or "Work order completed and verified",
                "actual_cost": update.actual_cost or doc.get("estimated_cost", "₹0")
            }
            update_fields["completion_details"] = completion_details
            if update.actual_cost:
                update_fields["actual_cost"] = update.actual_cost

        await self.db.maintenance.update_one(
            {"$or": [{"work_order_id": order_id}, {"ticket_id": order_id}]},
            {
                "$set": update_fields,
                "$push": {"status_history": history_entry}
            }
        )

        # Propagate status to linked inspection
        linked_insp = doc.get("inspection_id") or doc.get("detection_id")
        if linked_insp:
            await self.db.detections.update_one(
                {"detection_id": linked_insp},
                {"$set": {"work_order_status": target_status}}
            )

        return await self.get_work_order_by_id(order_id)

    async def update_work_order_details(
        self, 
        order_id: str, 
        update: WorkOrderUpdate
    ) -> Dict[str, Any]:
        """Update assignment, priority, or target date of a work order."""
        doc = await self.get_work_order_by_id(order_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Work order '{order_id}' not found."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        set_fields: Dict[str, Any] = {"updated_at": now_iso}

        if update.priority:
            set_fields["priority"] = update.priority
        if update.assigned_team is not None:
            set_fields["assigned_team"] = update.assigned_team
            # Auto-assign if currently open
            if doc.get("status") == "Open" and update.assigned_team:
                set_fields["status"] = "Assigned"
                await self.db.maintenance.update_one(
                    {"$or": [{"work_order_id": order_id}, {"ticket_id": order_id}]},
                    {
                        "$push": {
                            "status_history": {
                                "from_status": "Open",
                                "to_status": "Assigned",
                                "changed_at": now_iso,
                                "notes": f"Assigned to team '{update.assigned_team}'"
                            }
                        }
                    }
                )
        if update.description:
            set_fields["description"] = update.description
        if update.target_completion_date:
            set_fields["target_completion_date"] = update.target_completion_date
        if update.road_name:
            set_fields["road_name"] = update.road_name

        await self.db.maintenance.update_one(
            {"$or": [{"work_order_id": order_id}, {"ticket_id": order_id}]},
            {"$set": set_fields}
        )

        return await self.get_work_order_by_id(order_id)

    async def get_maintenance_statistics(self) -> Dict[str, Any]:
        """
        Aggregate live maintenance metrics directly from MongoDB.
        Never fabricates records or returns mock numbers.
        """
        total = await self.db.maintenance.count_documents({})
        open_count = await self.db.maintenance.count_documents({"status": {"$in": ["Open", "Pending", "Pending Triage"]}})
        assigned_count = await self.db.maintenance.count_documents({"status": {"$in": ["Assigned", "Scheduled"]}})
        in_progress = await self.db.maintenance.count_documents({"status": "In Progress"})
        completed = await self.db.maintenance.count_documents({"status": "Completed"})
        cancelled = await self.db.maintenance.count_documents({"status": "Cancelled"})
        
        high_priority_unresolved = await self.db.maintenance.count_documents({
            "priority": {"$in": ["High", "Critical"]},
            "status": {"$nin": ["Completed", "Cancelled"]}
        })

        # Calculate estimated cost across all active & total work orders
        all_docs = await self.db.maintenance.find({}, {"estimated_cost": 1}).to_list(length=100000)
        total_cost_num = sum(parse_cost_value(d.get("estimated_cost")) for d in all_docs)

        # Priority breakdown
        priorities = ["Critical", "High", "Medium", "Low"]
        priority_dist = {}
        for p in priorities:
            priority_dist[p] = await self.db.maintenance.count_documents({"priority": {"$regex": f"^{p}$", "$options": "i"}})

        # Category breakdown
        category_pipeline = [
            {"$group": {"_id": "$damage_category", "count": {"$sum": 1}}}
        ]
        cat_results = await self.db.maintenance.aggregate(category_pipeline).to_list(length=50)
        category_dist = {r["_id"] or "Uncategorized": r["count"] for r in cat_results}

        # Team breakdown
        team_pipeline = [
            {"$group": {"_id": {"$ifNull": ["$assigned_team", "Unassigned"]}, "count": {"$sum": 1}}}
        ]
        team_results = await self.db.maintenance.aggregate(team_pipeline).to_list(length=50)
        team_dist = {r["_id"]: r["count"] for r in team_results}

        return {
            "total_work_orders": total,
            "open_work_orders": open_count,
            "assigned_work_orders": assigned_count,
            "in_progress_work_orders": in_progress,
            "completed_work_orders": completed,
            "cancelled_work_orders": cancelled,
            "high_priority_unresolved": high_priority_unresolved,
            "total_estimated_cost_val": total_cost_num,
            "formatted_total_estimated_cost": f"₹{total_cost_num:,.0f}" if total_cost_num > 0 else "₹0",
            "status_distribution": {
                "Open": open_count,
                "Assigned": assigned_count,
                "In Progress": in_progress,
                "Completed": completed,
                "Cancelled": cancelled
            },
            "priority_distribution": priority_dist,
            "category_distribution": category_dist,
            "team_distribution": team_dist
        }
