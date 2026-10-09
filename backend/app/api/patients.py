from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
from app.database import get_db
from app.models import Patient, FollowupChart, Task, User, AuditLog, Connection, Provider
from app.schemas import PatientCreate, PatientOut, FollowupChartOut
from app.security import get_current_user_data, require_role
from app.services.pdf_service import generate_discharge_plan_pdf

router = APIRouter(prefix="/api/patients", tags=["Patients"])

@router.get("/connected", response_model=List[PatientOut])
def get_connected_patients(
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    conns = db.query(Connection).filter(
        Connection.hospital_id == h_id,
        Connection.status == "accepted"
    ).all()
    p_ids = [c.patient_id for c in conns]

    patients = db.query(Patient).filter(Patient.id.in_(p_ids)).all()
    return patients

@router.get("/", response_model=List[PatientOut])
def list_patients(
    q: Optional[str] = None,
    district: Optional[str] = None,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query = db.query(Patient)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        conns = db.query(Connection).filter(
            Connection.hospital_id == h_id,
            Connection.status == "accepted"
        ).all()
        p_ids = [c.patient_id for c in conns]
        query = query.filter(Patient.id.in_(p_ids))
    elif current_user["role"] == "patient":
        query = query.filter(Patient.id == current_user["patient_id"])

    if q:
        query = query.filter(Patient.name.ilike(f"%{q}%") | Patient.patient_code.ilike(f"%{q}%"))
    if district and district != "All":
        query = query.filter(Patient.district == district)

    return query.all()

@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        conn = db.query(Connection).filter(
            Connection.hospital_id == current_user["hospital_id"],
            Connection.patient_id == patient_id,
            Connection.status == "accepted"
        ).first()
        if not conn:
            raise HTTPException(status_code=403, detail="Hospital is not connected to this patient.")
    elif current_user["role"] == "patient":
        if patient_id != current_user["patient_id"]:
            raise HTTPException(status_code=403, detail="Patients can only view their own profile.")

    return patient

@router.get("/{patient_id}/charts", response_model=List[FollowupChartOut])
def get_patient_charts(
    patient_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query = db.query(FollowupChart).filter(FollowupChart.patient_id == patient_id)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        query = query.filter(FollowupChart.hospital_id == current_user["hospital_id"])
    
    charts = query.order_by(FollowupChart.id.desc()).all()
    res = []
    for c in charts:
        hospital = db.query(Provider).filter(Provider.provider_id == c.hospital_id).first()
        c_out = FollowupChartOut.model_validate(c)
        if hospital: c_out.hospital_name = hospital.name
        res.append(c_out)
    return res

@router.get("/{patient_id}/chart", response_model=Optional[FollowupChartOut])
def get_patient_latest_chart(
    patient_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query = db.query(FollowupChart).filter(FollowupChart.patient_id == patient_id)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        query = query.filter(FollowupChart.hospital_id == current_user["hospital_id"])
        
    chart = query.order_by(FollowupChart.id.desc()).first()
    if chart:
        hospital = db.query(Provider).filter(Provider.provider_id == chart.hospital_id).first()
        c_out = FollowupChartOut.model_validate(chart)
        if hospital: c_out.hospital_name = hospital.name
        return c_out
    return None

@router.get("/{patient_id}/download-pdf")
def download_patient_pdf(
    patient_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Authorization check (403 Forbidden for unconnected hospital / unauthorized patient)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        conn = db.query(Connection).filter(
            Connection.hospital_id == current_user["hospital_id"],
            Connection.patient_id == patient_id,
            Connection.status == "accepted"
        ).first()
        if not conn:
            raise HTTPException(status_code=403, detail="Forbidden: Hospital is not connected to this patient.")
    elif current_user["role"] == "patient":
        if patient_id != current_user.get("patient_id"):
            raise HTTPException(status_code=403, detail="Forbidden: Patients can only view their own discharge plan.")
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    chart = db.query(FollowupChart).filter(FollowupChart.patient_id == patient_id).order_by(FollowupChart.id.desc()).first()
    tasks = chart.tasks if chart else []
    tasks_data = [{"category": t.category, "instruction_text": t.instruction_text, "simple_text": t.simple_text, "status": t.status} for t in tasks]

    patient_data = {
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "patient_code": patient.patient_code,
        "district": patient.district,
        "hospital_name": "CareBridge Partner Hospital"
    }

    pdf_bytes = generate_discharge_plan_pdf(patient_data, tasks_data)

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="DOWNLOAD_PATIENT_PDF",
        entity_type="Patient",
        entity_id=str(patient_id),
        details=f"Downloaded PDF discharge care plan for patient {patient.name} ({patient.patient_code})"
    )
    db.add(audit)
    db.commit()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=carebridge_discharge_{patient.patient_code}.pdf"}
    )
