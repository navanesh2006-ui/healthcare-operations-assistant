from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from app.database import get_db
from app.models import Patient, DischargeSummary, FollowupChart, Task, AuditLog, Connection, Provider
from app.schemas import DischargeUploadRequest, FollowupChartOut
from app.security import require_role, get_current_user_data
from app.services.pipeline import run_agent_pipeline
from app.services.pdf_service import generate_analysis_report_pdf

router = APIRouter(prefix="/api/discharge", tags=["Discharge"])

@router.post("/process", response_model=FollowupChartOut)
def process_discharge(
    req: DischargeUploadRequest,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Strict Connection Check
    conn = db.query(Connection).filter(
        Connection.hospital_id == h_id,
        Connection.patient_id == req.patient_id,
        Connection.status == "accepted"
    ).first()

    if not conn:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital does not have an accepted connection with this patient. Send a follow request first and wait for patient acceptance."
        )

    patient_info = {
        "name": patient.name,
        "patient_code": patient.patient_code,
        "age": patient.age,
        "gender": patient.gender
    }

    # Run agent extraction pipeline with patient mismatch check
    pipeline_res = run_agent_pipeline(req.raw_text, patient_info=patient_info)
    extracted_tasks = pipeline_res["tasks"]
    analysis_report = pipeline_res["analysis_report"]

    # Check Patient Mismatch
    sec_a = analysis_report.get("section_a", {})
    if sec_a.get("is_mismatch") and not req.confirm_mismatch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=sec_a.get("mismatch_detail") or f"The summary appears to be for {sec_a.get('summary_patient_name')}, but you selected {patient.name}."
        )

    if sec_a.get("is_mismatch") and req.confirm_mismatch:
        audit_mismatch = AuditLog(
            user_id=current_user["user_id"],
            user_role=current_user["role"],
            action="CONFIRM_SUMMARY_PATIENT_MISMATCH",
            entity_type="Patient",
            entity_id=str(patient.id),
            details=f"Staff confirmed summary belonging to {sec_a.get('summary_patient_name')} for patient {patient.name} ({patient.patient_code})"
        )
        db.add(audit_mismatch)

    # Store raw discharge summary
    ds = DischargeSummary(
        patient_id=patient.id,
        hospital_id=h_id,
        raw_text=req.raw_text,
        status="Processed"
    )
    db.add(ds)
    db.flush()

    # Create FollowupChart
    chart = FollowupChart(
        patient_id=patient.id,
        hospital_id=h_id,
        is_published=False,
        analysis_report=analysis_report
    )
    db.add(chart)
    db.flush()

    tasks_objs = []
    for t_data in extracted_tasks:
        t_obj = Task(
            chart_id=chart.id,
            patient_id=patient.id,
            hospital_id=h_id,
            title=t_data["title"],
            category=t_data["category"],
            instruction_text=t_data["instruction_text"],
            simple_text=t_data["simple_text"],
            simple_ta=t_data.get("simple_ta"),
            simple_hi=t_data.get("simple_hi"),
            evidence_sentence=t_data.get("evidence_sentence"),
            evidence_field=t_data.get("evidence_field"),
            confidence_score=t_data.get("confidence_score", 0.9),
            due_date=t_data.get("due_date"),
            relative_days=t_data.get("relative_days"),
            needs_review=t_data.get("needs_review", False),
            status=t_data.get("status", "Pending"),
            reviewer_notes=t_data.get("reviewer_notes")
        )
        db.add(t_obj)
        tasks_objs.append(t_obj)

    # Audit log entry
    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="PROCESS_DISCHARGE_SUMMARY",
        entity_type="FollowupChart",
        entity_id=str(chart.id),
        details=f"Processed discharge text for connected Patient {patient.name} ({patient.patient_code}). Extracted {len(tasks_objs)} tasks."
    )
    db.add(audit)
    db.commit()
    db.refresh(chart)

    provider = db.query(Provider).filter(Provider.provider_id == h_id).first()
    c_out = FollowupChartOut.model_validate(chart)
    if provider:
        c_out.hospital_name = provider.name
    return c_out

@router.get("/report-pdf/{chart_id}")
def download_analysis_report_pdf(
    chart_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    chart = db.query(FollowupChart).filter(FollowupChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    # Access check: patient or connected hospital
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        if chart.hospital_id != current_user["hospital_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access chart")
    elif current_user["role"] == "patient":
        if chart.patient_id != current_user["patient_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to access chart")

    report_data = chart.analysis_report
    if not report_data:
        # Fallback to generating pipeline report from raw text if missing
        ds = db.query(DischargeSummary).filter(DischargeSummary.patient_id == chart.patient_id).order_by(DischargeSummary.id.desc()).first()
        raw_text = ds.raw_text if ds else "PATIENT DISCHARGE SUMMARY"
        patient = db.query(Patient).filter(Patient.id == chart.patient_id).first()
        patient_info = {"name": patient.name, "patient_code": patient.patient_code, "age": patient.age, "gender": patient.gender} if patient else None
        pipeline_res = run_agent_pipeline(raw_text, patient_info=patient_info)
        report_data = pipeline_res["analysis_report"]

    provider = db.query(Provider).filter(Provider.provider_id == chart.hospital_id).first()
    h_name = provider.name if provider else "CareBridge Hospital"

    pdf_bytes = generate_analysis_report_pdf(report_data, hospital_name=h_name)

    # Log PDF download in audit log
    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="DOWNLOAD_ANALYSIS_REPORT_PDF",
        entity_type="FollowupChart",
        entity_id=str(chart.id),
        details=f"Downloaded 6-section Analysis Report PDF for Chart #{chart.id}"
    )
    db.add(audit)
    db.commit()

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Discharge_Analysis_Report_Chart_{chart.id}.pdf"'}
    )
