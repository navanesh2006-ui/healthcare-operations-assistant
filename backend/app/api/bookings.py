import secrets
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.config import settings
from app.models import (
    BookingRequest, Task, AvailabilitySlot, Doctor, Provider, Patient,
    Notification, AuditLog, EmailActionToken, Document
)
from app.schemas import BookingCreateRequest, BookingOut, EmailActionDetailsOut, EmailActionSubmit
from app.security import get_current_user_data, require_role
from app.services.email_service import send_real_email, generate_ics_calendar
from app.services.pdf_service import generate_discharge_plan_pdf

router = APIRouter(prefix="/api/bookings", tags=["Bookings & Email Actions"])

@router.post("/request", response_model=BookingOut)
def request_booking(
    req: BookingCreateRequest,
    current_user: dict = Depends(require_role(["patient"])),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == req.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == req.slot_id).first()
    if not slot or slot.is_booked:
        raise HTTPException(status_code=400, detail="Requested slot is unavailable")

    doctor = db.query(Doctor).filter(Doctor.id == req.doctor_id).first()
    hospital = db.query(Provider).filter(Provider.provider_id == req.hospital_id).first()
    patient = db.query(Patient).filter(Patient.id == current_user["patient_id"]).first()

    # Create EmailActionToken (expiring in 7 days)
    action_token_str = secrets.token_urlsafe(24)
    action_token = EmailActionToken(
        token=action_token_str,
        action_type="booking_accept_decline",
        task_id=task.id,
        patient_id=patient.id,
        hospital_id=req.hospital_id,
        is_used=False,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
    )
    db.add(action_token)
    db.flush()

    task.status = "Needs Review"

    booking = BookingRequest(
        patient_id=current_user["patient_id"],
        task_id=task.id,
        hospital_id=req.hospital_id,
        doctor_id=req.doctor_id,
        slot_id=req.slot_id,
        status="Requested",
        token=action_token_str
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    action_token.booking_request_id = booking.id
    db.commit()

    # Action URLs pointing to PUBLIC_BASE_URL
    accept_url = f"{settings.PUBLIC_BASE_URL}/email-action/{action_token_str}?action=accept"
    decline_url = f"{settings.PUBLIC_BASE_URL}/email-action/{action_token_str}?action=decline"

    hosp_name = hospital.name if hospital else req.hospital_id
    hosp_dist = hospital.district if hospital else "Tamil Nadu"

    # Generate patient follow-up chart PDF attachment
    tasks = db.query(Task).filter(Task.patient_id == patient.id).all()
    tasks_data = [
        {
            "category": t.category,
            "instruction_text": t.instruction_text,
            "simple_text": t.simple_text,
            "status": t.status
        } for t in tasks
    ]
    patient_pdf_data = {
        "name": patient.name,
        "patient_code": patient.patient_code,
        "age": patient.age,
        "gender": patient.gender,
        "district": patient.district,
        "hospital_name": hosp_name
    }
    pdf_bytes = generate_discharge_plan_pdf(patient_pdf_data, tasks_data)

    attachments = [
        (f"CareBridge_Followup_Chart_{patient.patient_code}.pdf", pdf_bytes, "application/pdf")
    ]

    # Collect patient document attachments
    patient_docs = db.query(Document).filter(Document.patient_id == patient.id).all()
    doc_notes = ""
    if patient_docs:
        doc_notes = "<p><strong>Patient Attached Documents:</strong></p><ul>" + "".join([f"<li>{d.file_name} ({d.document_type})</li>" for d in patient_docs]) + "</ul>"

    email_body_hosp = f"""
    <div style="padding: 10px;">
        <h2 style="color: #4CAF50; margin-top: 0;">CareBridge: New Follow-up Appointment Request</h2>
        <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 16px; border-radius: 10px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-size: 14px; color: #8BC34A;"><strong>Requested Hospital Facility:</strong> {hosp_name}, {hosp_dist}</p>
            <p style="margin: 0 0 6px 0;"><strong>Patient Name:</strong> {patient.name} (ID: <span style="font-family: monospace; color: #8BC34A;">{patient.patient_code}</span>)</p>
            <p style="margin: 0 0 6px 0;"><strong>Requested Doctor/Dept:</strong> {doctor.name if doctor else 'Doctor'} ({doctor.department if doctor else ''})</p>
            <p style="margin: 0 0 6px 0;"><strong>Requested Date & Time Slot:</strong> {slot.date} at {slot.start_time} - {slot.end_time}</p>
            <p style="margin: 0;"><strong>Follow-up Care Step:</strong> {task.title}</p>
        </div>
        
        {doc_notes}
        <p style="font-size: 13px; color: #9EBE9E;">The patient's full follow-up care chart is attached to this email as a PDF document.</p>

        <!-- HTML Action Buttons -->
        <div style="margin: 30px 0; text-align: center;">
            <a href="{accept_url}" target="_blank" style="background-color: #4CAF50; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px; margin-right: 12px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">Accept Appointment</a>
            <a href="{decline_url}" target="_blank" style="background-color: #DC2626; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">Decline / Suggest Another Time</a>
        </div>
    </div>
    """

    # 1. Dispatch email to HOSPITAL_DEMO_EMAIL (gmhospital1980@gmail.com)
    send_real_email(
        db=db,
        recipient_email=settings.HOSPITAL_DEMO_EMAIL,
        recipient_name=hosp_name,
        subject=f"[CareBridge Booking Request] {patient.name} ({patient.patient_code}) - {slot.date}",
        body_html=email_body_hosp,
        email_type="booking_request",
        attachments=attachments,
        is_hospital_target=True
    )

    # 2. Immediate confirmation email to Patient
    email_body_pat = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Your Appointment Request Was Sent</h3>
        <p>Dear {patient.name},</p>
        <p>Your appointment request has been submitted to <strong>{hosp_name}</strong> ({hosp_dist}).</p>
        <ul>
            <li><strong>Doctor:</strong> {doctor.name if doctor else ''} ({doctor.department if doctor else ''})</li>
            <li><strong>Requested Date & Time:</strong> {slot.date} at {slot.start_time} - {slot.end_time}</li>
        </ul>
        <p>You will receive another email and in-app notification as soon as the hospital confirms your appointment slot.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=patient.email,
        recipient_name=patient.name,
        subject=f"Your appointment request was sent to {hosp_name}",
        body_html=email_body_pat,
        email_type="booking_request_patient_notice"
    )

    # Add in-app notification
    notif = Notification(
        user_id=patient.id,
        title="Appointment Request Sent",
        message=f"Your appointment request for {slot.date} was sent to {hosp_name}.",
        type="info"
    )
    db.add(notif)

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role="patient",
        action="REQUEST_BOOKING",
        entity_type="BookingRequest",
        entity_id=str(booking.id),
        details=f"Patient {patient.name} requested slot {slot.date} {slot.start_time} at {hosp_name}"
    )
    db.add(audit)
    db.commit()

    return booking

@router.get("/action-token/{token}", response_model=EmailActionDetailsOut)
def get_action_token_details(token: str, db: Session = Depends(get_db)):
    """Retrieves token details for single-use email action page (/email-action/:token)."""
    tok_obj = db.query(EmailActionToken).filter(EmailActionToken.token == token).first()
    if not tok_obj:
        raise HTTPException(status_code=404, detail="Invalid action token.")

    booking = db.query(BookingRequest).filter(BookingRequest.id == tok_obj.booking_request_id).first()
    patient = db.query(Patient).filter(Patient.id == tok_obj.patient_id).first() if tok_obj.patient_id else None
    hospital = db.query(Provider).filter(Provider.provider_id == tok_obj.hospital_id).first() if tok_obj.hospital_id else None
    
    doctor = None
    slot = None
    if booking:
        doctor = db.query(Doctor).filter(Doctor.id == booking.doctor_id).first()
        slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == booking.slot_id).first()

    is_expired = tok_obj.expires_at < datetime.datetime.utcnow()

    return EmailActionDetailsOut(
        token=token,
        action_type=tok_obj.action_type,
        is_used=tok_obj.is_used,
        is_expired=is_expired,
        patient_name=patient.name if patient else "Patient",
        patient_code=patient.patient_code if patient else "PAT-XXXXXX",
        hospital_name=hospital.name if hospital else "Hospital Facility",
        hospital_district=hospital.district if hospital else "Tamil Nadu",
        doctor_name=doctor.name if doctor else "Doctor",
        department=doctor.department if doctor else "Specialty OPD",
        date_slot=slot.date if slot else "",
        time_slot=f"{slot.start_time} - {slot.end_time}" if slot else "",
        status=booking.status if booking else "Pending"
    )

@router.post("/action-token/{token}")
def process_action_token(token: str, req: EmailActionSubmit, db: Session = Depends(get_db)):
    """Processes Accept or Decline action from email link (or action page)."""
    tok_obj = db.query(EmailActionToken).filter(EmailActionToken.token == token).first()
    if not tok_obj:
        raise HTTPException(status_code=404, detail="Invalid action token.")

    if tok_obj.is_used:
        raise HTTPException(status_code=400, detail="This action link has already been completed.")

    if tok_obj.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="This action link has expired.")

    booking = db.query(BookingRequest).filter(BookingRequest.id == tok_obj.booking_request_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Associated booking request not found.")

    patient = db.query(Patient).filter(Patient.id == booking.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == booking.doctor_id).first()
    hospital = db.query(Provider).filter(Provider.provider_id == booking.hospital_id).first()
    slot = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == booking.slot_id).first()
    task = db.query(Task).filter(Task.id == booking.task_id).first()

    action_str = req.action.lower()

    if action_str == "accept":
        booking.status = "Confirmed"
        if slot:
            slot.is_booked = True
            slot.booked_by_patient_id = booking.patient_id

        if task:
            task.status = "Scheduled"
            task.scheduled_hospital_id = booking.hospital_id
            task.scheduled_doctor_id = booking.doctor_id
            task.scheduled_slot_id = booking.slot_id

        # Generate iCalendar (.ics) invite
        start_dt = datetime.datetime.strptime(f"{slot.date} {slot.start_time}", "%Y-%m-%d %H:%M") if (slot and slot.date and slot.start_time) else datetime.datetime.utcnow() + datetime.timedelta(days=1)
        ics_content = generate_ics_calendar(
            event_title=f"CareBridge Appointment: {doctor.name if doctor else 'Doctor'}",
            description=f"Follow-up visit for task: {task.title if task else ''} at {hospital.name if hospital else ''}",
            start_time=start_dt,
            location=f"{hospital.name if hospital else 'Hospital'}, {hospital.district if hospital else ''}"
        )

        maps_query = f"{hospital.name if hospital else ''}, {hospital.district if hospital else ''}"
        maps_link = f"https://www.google.com/maps/search/?api=1&query={maps_query.replace(' ', '+')}"

        patient_body = f"""
        <div style="padding: 10px;">
            <h2 style="color: #4CAF50; margin-top: 0;">CareBridge: Appointment Confirmed!</h2>
            <p>Dear {patient.name},</p>
            <p>Your follow-up appointment request has been <strong>CONFIRMED</strong> by the hospital care team.</p>
            
            <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 18px; border-radius: 10px; margin: 16px 0;">
                <p style="margin: 0 0 6px 0; font-size: 15px; color: #8BC34A; font-weight: bold;">{hospital.name if hospital else 'Hospital'}</p>
                <p style="margin: 0 0 6px 0;"><strong>Doctor:</strong> {doctor.name if doctor else 'Doctor'} ({doctor.department if doctor else ''})</p>
                <p style="margin: 0 0 6px 0;"><strong>Date & Time:</strong> {slot.date if slot else ''} at {slot.start_time if slot else ''} - {slot.end_time if slot else ''}</p>
                <p style="margin: 0 0 6px 0;"><strong>Address:</strong> {hospital.address if (hospital and hospital.address) else 'Hospital OPD'}, {hospital.district if hospital else ''}</p>
                <p style="margin: 6px 0 0 0; font-size: 12px;"><a href="{maps_link}" target="_blank" style="color: #8BC34A; text-decoration: underline;">Open Location on Google Maps (Approximate)</a></p>
            </div>

            <p style="font-size: 13px; color: #9EBE9E;">An iCalendar (.ics) event invite is attached to this email so you can add this appointment directly to your Google / Apple Calendar.</p>
        </div>
        """

        send_real_email(
            db=db,
            recipient_email=patient.email,
            recipient_name=patient.name,
            subject=f"Your appointment is confirmed at {hospital.name if hospital else 'Hospital'}",
            body_html=patient_body,
            email_type="booking_confirmed",
            attachments=[("carebridge_appointment.ics", ics_content.encode('utf-8'), "text/calendar")]
        )

        notif = Notification(
            user_id=patient.id,
            title="Appointment Confirmed!",
            message=f"Your appointment with {doctor.name if doctor else 'Doctor'} on {slot.date if slot else ''} is confirmed.",
            type="success"
        )
        db.add(notif)
        tok_obj.is_used = True
        db.commit()
        return {"message": "Appointment confirmed and patient notified with calendar invite."}

    else: # Decline
        booking.status = "Declined"
        if task:
            task.status = "Needs Review"
        choose_slot_link = f"{settings.PUBLIC_BASE_URL}/patient-portal"

        patient_body = f"""
        <div style="padding: 10px;">
            <h2 style="color: #DC2626; margin-top: 0;">Appointment Request Update</h2>
            <p>Dear {patient.name},</p>
            <p>Your requested appointment slot on {slot.date if slot else ''} could not be confirmed by {hospital.name if hospital else 'the hospital'}.</p>
            <p>Please click below to choose an alternate time slot or select another available doctor.</p>

            <div style="margin: 25px 0; text-align: center;">
                <a href="{choose_slot_link}" target="_blank" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">Choose Another Slot</a>
            </div>
        </div>
        """

        send_real_email(
            db=db,
            recipient_email=patient.email,
            recipient_name=patient.name,
            subject=f"Appointment Request Update from {hospital.name if hospital else 'Hospital'}",
            body_html=patient_body,
            email_type="booking_declined"
        )

        notif = Notification(
            user_id=patient.id,
            title="Appointment Request Declined",
            message=f"Your requested slot on {slot.date if slot else ''} was declined. Please choose an alternate slot.",
            type="warning"
        )
        db.add(notif)
        tok_obj.is_used = True
        db.commit()
        return {"message": "Booking request declined and patient notified."}

@router.get("/my-bookings", response_model=List[BookingOut])
def get_my_bookings(current_user: dict = Depends(get_current_user_data), db: Session = Depends(get_db)):
    if current_user["role"] == "patient":
        bookings = db.query(BookingRequest).filter(BookingRequest.patient_id == current_user["patient_id"]).order_by(BookingRequest.id.desc()).all()
    else:
        bookings = db.query(BookingRequest).filter(BookingRequest.hospital_id == current_user["hospital_id"]).order_by(BookingRequest.id.desc()).all()

    res = []
    for b in bookings:
        b_out = BookingOut.model_validate(b)
        h = db.query(Provider).filter(Provider.provider_id == b.hospital_id).first()
        doc = db.query(Doctor).filter(Doctor.id == b.doctor_id).first()
        s = db.query(AvailabilitySlot).filter(AvailabilitySlot.id == b.slot_id).first()
        if h: b_out.hospital_name = h.name
        if doc: b_out.doctor_name = doc.name
        if s:
            b_out.slot_date = s.date
            b_out.slot_time = f"{s.start_time} - {s.end_time}"
        res.append(b_out)
    return res
