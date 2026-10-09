from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Feedback, Patient
from app.schemas import FeedbackCreate, FeedbackOut
from app.security import get_current_user_data, require_role

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])

@router.post("/", response_model=FeedbackOut)
def submit_feedback(
    req: FeedbackCreate,
    current_user: dict = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.id == current_user["patient_id"]).first()
    h_id = patient.hospital_id if patient else "TN23727"

    fb = Feedback(
        patient_id=current_user["patient_id"],
        hospital_id=h_id,
        doctor_id=req.doctor_id,
        department=req.department or "General",
        task_id=req.task_id,
        rating=req.rating,
        comment=req.comment or "",
        source=req.source or "appointment"
    )
    db.add(fb)
    db.refresh(fb)

    # Dispatch email notification to HOSPITAL_DEMO_EMAIL
    if patient:
        from app.config import settings
        from app.services.email_service import send_real_email
        fb_body = f"""
        <div style="padding: 10px;">
            <h3 style="color: #4CAF50; margin-top: 0;">New Patient Feedback Received</h3>
            <p>Patient <strong>{patient.name}</strong> (ID: <span style="font-family: monospace; color: #8BC34A;">{patient.patient_code}</span>) submitted feedback:</p>
            <ul>
                <li><strong>Rating:</strong> {'⭐' * fb.rating} ({fb.rating}/5)</li>
                <li><strong>Department:</strong> {fb.department}</li>
                <li><strong>Comment:</strong> "{fb.comment}"</li>
            </ul>
        </div>
        """
        send_real_email(
            db=db,
            recipient_email=settings.HOSPITAL_DEMO_EMAIL,
            recipient_name="Hospital Administration",
            subject=f"[CareBridge Feedback] {fb.rating}/5 Star Rating from {patient.name}",
            body_html=fb_body,
            email_type="feedback_submitted",
            is_hospital_target=True
        )

    return fb

@router.get("/", response_model=List[FeedbackOut])
def get_hospital_feedback(
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query = db.query(Feedback)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"] and current_user["hospital_id"]:
        query = query.filter(Feedback.hospital_id == current_user["hospital_id"])
    elif current_user["role"] == "patient":
        query = query.filter(Feedback.patient_id == current_user["patient_id"])

    if department and department != "All":
        query = query.filter(Feedback.department == department)

    return query.order_by(Feedback.id.desc()).all()
