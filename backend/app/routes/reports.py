from fastapi import APIRouter, Depends, Query, Response, status
from typing import Optional
from app.dependencies import get_pdf_report_service
from app.auth_dependencies import require_authenticated, require_admin

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/inspection/{detection_id}")
async def download_inspection_report(
    detection_id: str,
    service = Depends(get_pdf_report_service),
    current_user: dict = Depends(require_authenticated)
):
    """
    Generate and download a professional PDF inspection report for an individual image or video inspection.
    Includes verified GPS coordinates, defect bounding-box coordinates, representative previews,
    linked work orders, and civil engineering statutory disclaimers.
    """
    pdf_bytes = await service.generate_inspection_pdf(detection_id)
    safe_filename = f"Wayzo-Report-{detection_id}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/summary")
async def download_summary_report(
    start_date: Optional[str] = Query(None, description="Start date filter in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date filter in YYYY-MM-DD format"),
    service = Depends(get_pdf_report_service),
    current_user: dict = Depends(require_admin)
):
    """
    Generate and download a date-filtered or global executive summary PDF report.
    Contains total inspections, defect category distributions, severity distributions,
    located vs unlocated inspections, and maintenance work order operations.
    Calculated strictly from actual MongoDB records.
    """
    pdf_bytes = await service.generate_summary_pdf(start_date=start_date, end_date=end_date)
    
    filename_part = f"{start_date or 'All'}-to-{end_date or 'Latest'}"
    safe_filename = f"Wayzo-Summary-Report-{filename_part}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
