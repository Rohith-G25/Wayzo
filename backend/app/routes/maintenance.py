from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from app.dependencies import get_maintenance_service
from app.auth_dependencies import require_authenticated, require_inspector, require_maintenance
from app.services.maintenance_service import MaintenanceService
from app.schemas.maintenance import (
    WorkOrderCreate,
    WorkOrderResponse,
    WorkOrderStatusUpdate,
    WorkOrderUpdate,
    MaintenanceStatisticsResponse,
    MaintenanceCreate,
    MaintenanceResponse
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])

@router.get("/statistics", response_model=MaintenanceStatisticsResponse)
async def get_maintenance_statistics(
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_authenticated)
):
    """
    Retrieve live aggregated statistics on work orders, statuses, priority distributions,
    and estimated repair costs directly from MongoDB.
    """
    return await service.get_maintenance_statistics()

@router.post("", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance_work_order(
    order: WorkOrderCreate,
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_inspector)
):
    """
    Create a new maintenance work order.
    If linked to an inspection_id, verifies the database record and copies authentic
    GPS coordinates and defect metrics without fabrication.
    """
    return await service.create_work_order(order)

@router.post("/from-inspection", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order_from_inspection(
    order: WorkOrderCreate,
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_inspector)
):
    """
    Dedicated endpoint to dispatch a work order directly from an inspection session.
    Verifies inspection existence in MongoDB.
    """
    if not order.inspection_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="inspection_id is required to create a work order from an inspection."
        )
    return await service.create_work_order(order)

@router.get("", response_model=List[WorkOrderResponse])
async def get_maintenance_work_orders(
    status: Optional[str] = Query("all", description="Filter by status: Open, Assigned, In Progress, Completed, Cancelled, or all"),
    priority: Optional[str] = Query("all", description="Filter by priority: Critical, High, Medium, Low, or all"),
    category: Optional[str] = Query("all", description="Filter by damage category: Pothole, Longitudinal Crack, etc."),
    team: Optional[str] = Query("all", description="Filter by assigned team name or 'unassigned'"),
    limit: int = Query(200, ge=1, le=1000),
    skip: int = Query(0, ge=0),
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_authenticated)
):
    """
    Retrieve maintenance work orders with optional filtering by status, priority,
    defect category, and assigned maintenance crew.
    """
    return await service.get_work_orders(
        status_filter=status,
        priority_filter=priority,
        category_filter=category,
        team_filter=team,
        limit=limit,
        skip=skip
    )

@router.get("/{order_id}", response_model=WorkOrderResponse)
async def get_work_order_details(
    order_id: str,
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_authenticated)
):
    """
    Retrieve full details for a single work order by work_order_id or ticket_id.
    """
    doc = await service.get_work_order_by_id(order_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order '{order_id}' was not found."
        )
    return doc

@router.patch("/{order_id}/status", response_model=WorkOrderResponse)
async def update_work_order_status(
    order_id: str,
    status_update: WorkOrderStatusUpdate,
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_maintenance)
):
    """
    Update work order status through its defined lifecycle:
    Open -> Assigned -> In Progress -> Completed (or Cancelled).
    Validates state transitions and appends to audit history.
    """
    return await service.update_work_order_status(order_id, status_update)

@router.patch("/{order_id}", response_model=WorkOrderResponse)
async def update_work_order_details(
    order_id: str,
    update: WorkOrderUpdate,
    service: MaintenanceService = Depends(get_maintenance_service),
    current_user: dict = Depends(require_maintenance)
):
    """
    Update work order details such as priority, assigned crew, description, or target date.
    """
    return await service.update_work_order_details(order_id, update)
