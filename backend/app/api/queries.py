import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.config import settings
from app.models import PatientQuery, Patient, Task, User, Provider, Notification, AuditLog
from app.schemas import PatientQueryCreate, PatientQueryReply, PatientQueryOut
from app.security import get_current_user_data, require_role
from app.services.email_service import send_real_email

router = APIRouter(prefix="/api/queries", tags=["Patient Queries & Contact"])

@router.post("/contact-hospital", response_model=PatientQueryOut)
def contact_hospital(
    req: PatientQueryCreate,
    current_user: dict = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    """Allows a patient to submit a question/query to the hospital."""
    patient = db.query(Patient).filter(Patient.id == current_user["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    task = None
    if req.task_id:
        task = db.query(Task).filter(Task.id == req.task_id).first()

    query_obj = PatientQuery(
        patient_id=patient.id,
        task_id=req.task_id,
        question_text=req.question_text.strip(),
        status="pending"
    )
    db.add(query_obj)
    db.commit()
    db.refresh(query_obj)

    # 1. Dispatch email to HOSPITAL_DEMO_EMAIL (gmhospital1980@gmail.com)
    hosp_body = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">New Patient Question / Contact Escalation</h3>
        <p><strong>Patient Name:</strong> {patient.name} (ID: <span style="font-family: monospace; color: #8BC34A;">{patient.patient_code}</span>)</p>
        <p><strong>District:</strong> {patient.district}</p>
        {f'<p><strong>Related Chart Task:</strong> {task.title}</p>' if task else ''}
        <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #9EBE9E;">Question Text:</p>
            <p style="margin: 6px 0 0 0; font-style: italic; color: #ffffff;">"{query_obj.question_text}"</p>
        </div>
        <p>To respond, log into your CareBridge Hospital Portal under Patient Queries or use the portal reply button.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=settings.HOSPITAL_DEMO_EMAIL,
        recipient_name="Hospital Care Team",
        subject=f"[CareBridge Query] Question from {patient.name} ({patient.patient_code})",
        body_html=hosp_body,
        email_type="patient_query",
        is_hospital_target=True
    )

    # 2. Dispatch confirmation email to Patient
    pat_body = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Your Question Was Sent to the Hospital</h3>
        <p>Hello {patient.name},</p>
        <p>Your question has been transmitted to your hospital care coordinator:</p>
        <blockquote style="background-color: #12332B; padding: 12px; border-left: 3px solid #4CAF50; margin: 12px 0;">
            "{query_obj.question_text}"
        </blockquote>
        <p>You will receive an email and in-app notification as soon as the hospital care team replies.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=patient.email,
        recipient_name=patient.name,
        subject="Your question was sent to the hospital",
        body_html=pat_body,
        email_type="patient_query_confirmation"
    )

    # 3. Add in-app notification
    notif = Notification(
        user_id=patient.id,
        title="Question Submitted",
        message="Your question was sent to the hospital care team.",
        type="info"
    )
    db.add(notif)
    db.commit()

    return query_obj

@router.get("/my-queries", response_model=List[PatientQueryOut])
def get_my_queries(
    current_user: dict = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    """Patient retrieves their submitted questions and replies."""
    queries = db.query(PatientQuery).filter(PatientQuery.patient_id == current_user["patient_id"]).order_by(PatientQuery.id.desc()).all()
    res = []
    for q in queries:
        q_out = PatientQueryOut.model_validate(q)
        p = db.query(Patient).filter(Patient.id == q.patient_id).first()
        if p:
            q_out.patient_name = p.name
            q_out.patient_code = p.patient_code
        res.append(q_out)
    return res

@router.get("/hospital-queries", response_model=List[PatientQueryOut])
def get_hospital_queries(
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    """Hospital staff retrieves questions submitted by patients."""
    queries = db.query(PatientQuery).order_by(PatientQuery.id.desc()).all()
    res = []
    for q in queries:
        q_out = PatientQueryOut.model_validate(q)
        p = db.query(Patient).filter(Patient.id == q.patient_id).first()
        if p:
            q_out.patient_name = p.name
            q_out.patient_code = p.patient_code
        res.append(q_out)
    return res

@router.post("/{query_id}/reply", response_model=PatientQueryOut)
def reply_to_query(
    query_id: int,
    req: PatientQueryReply,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    """Hospital staff replies to a patient query."""
    q = db.query(PatientQuery).filter(PatientQuery.id == query_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Query not found")

    q.hospital_reply = req.reply_text.strip()
    q.status = "answered"
    q.replied_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(q)

    patient = db.query(Patient).filter(Patient.id == q.patient_id).first()
    if patient:
        # 1. Email reply to Patient
        reply_body = f"""
        <div style="padding: 10px;">
            <h3 style="color: #4CAF50; margin-top: 0;">Hospital Care Team Reply</h3>
            <p>Dear {patient.name},</p>
            <p>Your hospital care coordinator replied to your question:</p>
            <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #9EBE9E;">Your Original Question:</p>
                <p style="margin: 0 0 16px 0; font-style: italic;">"{q.question_text}"</p>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #8BC34A; font-weight: bold;">Hospital Response:</p>
                <p style="margin: 0; color: #ffffff;">{q.hospital_reply}</p>
            </div>
            <p>View your full care plan and updates on the CareBridge Patient Portal.</p>
        </div>
        """
        send_real_email(
            db=db,
            recipient_email=patient.email,
            recipient_name=patient.name,
            subject=f"[CareBridge] Hospital Response to Your Question",
            body_html=reply_body,
            email_type="hospital_reply"
        )

        # 2. Add in-app Notification
        notif = Notification(
            user_id=patient.id,
            title="Hospital Replied to Your Question",
            message=f"Hospital response: {q.hospital_reply[:100]}...",
            type="success"
        )
        db.add(notif)
        db.commit()

    q_out = PatientQueryOut.model_validate(q)
    if patient:
        q_out.patient_name = patient.name
        q_out.patient_code = patient.patient_code
    return q_out
