from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import datetime
from app.database import get_db
from app.models import Task, FollowupChart, Patient, Notification, AuditLog
from app.schemas import TaskOut, TaskReviewRequest, FollowupChartOut
from app.security import get_current_user_data, require_role
from app.services.second_brain import write_reviewer_decision_to_second_brain
from app.services.email_service import send_real_email

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

@router.get("/reviewer-queue", response_model=List[TaskOut])
def get_reviewer_queue(
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    tasks = db.query(Task).filter(Task.status == "Needs Review").all()
    return tasks

@router.post("/{task_id}/review", response_model=TaskOut)
def review_task(
    task_id: int,
    req: TaskReviewRequest,
    current_user: dict = Depends(require_role(["hospital_reviewer", "hospital_staff"])),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    orig_text = task.simple_text
    if req.action == "approve":
        task.status = "Pending"
        task.confidence_score = 1.0
        if req.simple_text:
            task.simple_text = req.simple_text
    elif req.action == "edit":
        task.status = "Pending"
        task.confidence_score = 1.0
        if req.simple_text:
            task.simple_text = req.simple_text
        if req.due_date:
            task.due_date = req.due_date
        
        # Save reviewer decision to Second Brain knowledge vault
        write_reviewer_decision_to_second_brain(
            db=db,
            task_id=task.id,
            reviewer_name=current_user.get("name", "Clinical Reviewer"),
            original_text=orig_text,
            corrected_text=task.simple_text,
            decision_reason=req.reviewer_notes or "Human clinical approval and clarification.",
            hospital_id=task.hospital_id,
            patient_id=task.patient_id
        )
    elif req.action == "reject":
        task.status = "Declined"

    task.reviewer_id = current_user["user_id"]
    task.reviewer_notes = req.reviewer_notes

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action=f"REVIEW_TASK_{req.action.upper()}",
        entity_type="Task",
        entity_id=str(task.id),
        details=f"Reviewer {current_user['name']} set action {req.action} on Task #{task.id}"
    )
    db.add(audit)
    db.commit()
    db.refresh(task)

    return task

@router.post("/charts/{chart_id}/publish", response_model=FollowupChartOut)
def publish_chart(
    chart_id: int,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    chart = db.query(FollowupChart).filter(FollowupChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    chart.is_published = True
    chart.published_at = datetime.datetime.utcnow()

    patient = db.query(Patient).filter(Patient.id == chart.patient_id).first()
    if patient:
        # Create In-App Notification for Patient
        notif = Notification(
            user_id=patient.id,
            title="Follow-up Chart Published",
            message="Your hospital has published a new follow-up care coordinator chart.",
            type="info"
        )
        db.add(notif)

        # Send Email Notification to Patient
        email_body = f"""
        <div style="font-family: sans-serif; background-color: #0B1F22; color: #E6F2E6; padding: 24px; border-radius: 12px;">
            <h2 style="color: #4CAF50;">CareBridge Hospital Follow-up Chart Published</h2>
            <p>Dear {patient.name},</p>
            <p>Your healthcare team has published your interactive follow-up coordinator plan.</p>
            <p><strong>Patient ID:</strong> {patient.patient_code}</p>
            <p>Please log in to your CareBridge Patient Portal to view your interactive schedule, medicine checklist, and book upcoming appointments.</p>
            <hr style="border-color: #1E4A38;"/>
            <p style="font-size: 12px; color: #94A3B8;">Directory & coordination note: CareBridge provides instruction guidance. In case of emergency, contact emergency medical services.</p>
        </div>
        """
        send_real_email(
            db=db,
            recipient_email=patient.email,
            recipient_name=patient.name,
            subject="CareBridge: Your Hospital Follow-up Chart is Ready",
            body_html=email_body,
            email_type="chart_published"
        )

    db.commit()
    db.refresh(chart)
    return chart

@router.patch("/{task_id}/status")
def update_task_status(
    task_id: int,
    status_str: str,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = status_str
    db.commit()
    return {"message": "Status updated successfully", "task_id": task.id, "status": status_str}
