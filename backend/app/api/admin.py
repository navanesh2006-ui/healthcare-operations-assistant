from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import EmailLog
from app.schemas import EmailLogOut
from app.services.email_service import send_real_email

router = APIRouter(prefix="/api/admin", tags=["Admin System"])

@router.get("/email-logs", response_model=List[EmailLogOut])
def get_email_logs(limit: int = 10, db: Session = Depends(get_db)):
    """Returns the last N email send statuses for system debugging."""
    logs = db.query(EmailLog).order_by(EmailLog.id.desc()).limit(limit).all()
    return logs

@router.post("/send-test-email")
def send_test_email(recipient_email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Dispatches a real test email via Gmail SMTP and logs status."""
    clean_addr = recipient_email.strip().lower()
    if not clean_addr:
        raise HTTPException(status_code=400, detail="Recipient email address is required.")

    body_html = f"""
    <div style="padding: 20px;">
        <h2 style="color: #4CAF50; margin-top: 0;">CareBridge Real Email Test</h2>
        <p>This is a live test message sent via Gmail SMTP from CareBridge Agentic Follow-up Coordinator.</p>
        <p><strong>Recipient:</strong> {clean_addr}</p>
        <p style="color: #8BC34A;">SMTP Delivery Verified!</p>
    </div>
    """
    
    log = send_real_email(
        db=db,
        recipient_email=clean_addr,
        recipient_name="CareBridge Tester",
        subject="[CareBridge] Real SMTP Delivery Verification Test",
        body_html=body_html,
        email_type="test_email",
        plain_text="CareBridge Real SMTP Delivery Verification Test Success!"
    )

    if log.status == "failed":
        raise HTTPException(status_code=500, detail=log.error_message or "Failed to dispatch email via SMTP.")

    return {"message": f"Real test email successfully dispatched to {clean_addr} via SMTP!", "log": log}
