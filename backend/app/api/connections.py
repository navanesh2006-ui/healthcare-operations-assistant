import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.config import settings
from app.models import Connection, Patient, User, Provider, Notification, AuditLog
from app.schemas import PatientSearchResult, SendConnectionRequest, ConnectionActionRequest, ConnectionOut
from app.security import get_current_user_data, require_role, mask_email
from app.services.email_service import send_real_email

router = APIRouter(prefix="/api/connections", tags=["Connections"])

@router.get("/find-patients", response_model=List[PatientSearchResult])
def find_patients(
    q: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    query = db.query(Patient).order_by(Patient.id.desc())

    if q and q.strip():
        clean_q = q.strip()
        query = query.filter(
            Patient.name.ilike(f"%{clean_q}%") | 
            Patient.patient_code.ilike(f"%{clean_q}%") | 
            Patient.email.ilike(f"%{clean_q}%")
        )

    patients = query.offset((page - 1) * limit).limit(limit).all()

    # Retrieve existing connections for this hospital
    connections = db.query(Connection).filter(Connection.hospital_id == h_id).all()
    conn_map = {c.patient_id: c for c in connections}

    results = []
    for p in patients:
        conn = conn_map.get(p.id)
        status_str = conn.status if conn else "not_connected"
        conn_id = conn.id if conn else None

        results.append(PatientSearchResult(
            id=p.id,
            patient_code=p.patient_code,
            name=p.name,
            masked_email=mask_email(p.email),
            district=p.district,
            connection_status=status_str,
            connection_id=conn_id
        ))

    return results

@router.post("/request", response_model=ConnectionOut)
def send_connection_request(
    req: SendConnectionRequest,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    hospital = db.query(Provider).filter(Provider.provider_id == h_id).first()
    h_name = hospital.name if hospital else h_id

    existing = db.query(Connection).filter(
        Connection.hospital_id == h_id,
        Connection.patient_id == req.patient_id
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Hospital is already connected to this patient.")
        existing.status = "pending"
        existing.message = req.message or ""
        existing.requested_at = datetime.datetime.utcnow()
        conn = existing
    else:
        conn = Connection(
            hospital_id=h_id,
            patient_id=req.patient_id,
            status="pending",
            message=req.message or f"You were treated at {h_name}. We would like to coordinate your post-discharge follow-up care."
        )
        db.add(conn)

    # In-App Notification for Patient
    p_user = db.query(User).filter(User.patient_id == req.patient_id).first()
    if p_user:
        notif = Notification(
            user_id=p_user.id,
            title="New Follow-up Connection Request",
            message=f"{h_name} has requested connection to coordinate your follow-up care.",
            type="info"
        )
        db.add(notif)

    # Notification Email to Patient
    email_body = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">CareBridge: New Follow-up Connection Request</h3>
        <p>Dear {patient.name},</p>
        <p><strong>{h_name}</strong> (Hospital ID: {h_id}) has sent you a follow-up coordination request.</p>
        <blockquote style="background-color: #12332B; border: 1px solid #1E4A38; padding: 12px; border-radius: 8px; font-style: italic;">
            "{conn.message}"
        </blockquote>
        <p>Please log in to your CareBridge Patient Portal to <strong>Accept</strong> or <strong>Decline</strong> this request.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=patient.email,
        recipient_name=patient.name,
        subject=f"CareBridge: Connection Request from {h_name}",
        body_html=email_body,
        email_type="follow_request"
    )

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="SEND_CONNECTION_REQUEST",
        entity_type="Connection",
        entity_id=str(req.patient_id),
        details=f"Hospital {h_name} sent connection request to Patient {patient.name} ({patient.patient_code})"
    )
    db.add(audit)
    db.commit()
    db.refresh(conn)

    c_out = ConnectionOut.model_validate(conn)
    c_out.hospital_name = h_name
    c_out.patient_name = patient.name
    c_out.patient_code = patient.patient_code
    return c_out

@router.post("/{connection_id}/action", response_model=ConnectionOut)
def connection_action(
    connection_id: int,
    req: ConnectionActionRequest,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    conn = db.query(Connection).filter(Connection.id == connection_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found")

    action = req.action.lower()

    if current_user["role"] == "patient":
        patient_id = current_user.get("patient_id")
        if patient_id is None:
            u = db.query(User).filter(User.id == current_user["user_id"]).first()
            if u:
                patient_id = u.patient_id

        if patient_id is None or str(conn.patient_id) != str(patient_id):
            raise HTTPException(status_code=403, detail="Unauthorized connection action")
        
        if action == "accept":
            conn.status = "accepted"
        elif action == "decline":
            conn.status = "declined"
        elif action == "revoke":
            conn.status = "revoked"
        conn.responded_at = datetime.datetime.utcnow()

    elif current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        hospital_id = current_user.get("hospital_id")
        if not hospital_id:
            u = db.query(User).filter(User.id == current_user["user_id"]).first()
            if u:
                hospital_id = u.hospital_id

        if hospital_id is None or str(conn.hospital_id) != str(hospital_id):
            raise HTTPException(status_code=403, detail="Unauthorized connection action")
        
        if action == "cancel":
            conn.status = "declined"

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action=f"CONNECTION_{action.upper()}",
        entity_type="Connection",
        entity_id=str(conn.id),
        details=f"User {current_user['name']} set status to {conn.status} on connection #{conn.id}"
    )
    db.add(audit)

    hospital = db.query(Provider).filter(Provider.provider_id == conn.hospital_id).first()
    patient = db.query(Patient).filter(Patient.id == conn.patient_id).first()
    h_name = hospital.name if hospital else conn.hospital_id
    p_name = patient.name if patient else f"Patient #{conn.patient_id}"

    # Notify hospital users when patient takes action
    if current_user["role"] == "patient" and conn.hospital_id:
        h_users = db.query(User).filter(User.hospital_id == conn.hospital_id).all()
        for hu in h_users:
            notif = Notification(
                user_id=hu.id,
                title=f"Follow-up Request {conn.status.capitalize()}",
                message=f"{p_name} has {conn.status} your follow-up care connection request.",
                type="success" if conn.status == "accepted" else "warning"
            )
            db.add(notif)
            
            if conn.status == "accepted":
                email_body = f"""
                <div style="padding: 10px;">
                    <h3 style="color: #4CAF50; margin-top: 0;">CareBridge: Connection Request Accepted!</h3>
                    <p>Dear {hu.name},</p>
                    <p>Patient <strong>{p_name}</strong> (Patient ID: <span style="font-family: monospace; color: #8BC34A;">{patient.patient_code if patient else conn.patient_id}</span>) has accepted your follow-up coordination request.</p>
                    <p>You can now view this patient under <strong>"My Patients"</strong> in the Hospital Portal and create follow-up care charts.</p>
                </div>
                """
                send_real_email(
                    db=db,
                    recipient_email=settings.HOSPITAL_DEMO_EMAIL,
                    recipient_name=hu.name,
                    subject=f"CareBridge: Connection Request Accepted by {p_name}",
                    body_html=email_body,
                    email_type="request_status_change",
                    is_hospital_target=True
                )

    db.commit()

    c_out = ConnectionOut.model_validate(conn)
    if hospital: c_out.hospital_name = hospital.name
    if patient:
        c_out.patient_name = patient.name
        c_out.patient_code = patient.patient_code
    return c_out

@router.get("/my-connections", response_model=List[ConnectionOut])
def get_my_connections(
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    patient_id = current_user.get("patient_id")
    hospital_id = current_user.get("hospital_id")

    if current_user["role"] == "patient":
        if patient_id is None:
            u = db.query(User).filter(User.id == current_user["user_id"]).first()
            if u: patient_id = u.patient_id
        conns = db.query(Connection).filter(Connection.patient_id == patient_id).all()
    else:
        if hospital_id is None:
            u = db.query(User).filter(User.id == current_user["user_id"]).first()
            if u: hospital_id = u.hospital_id
        conns = db.query(Connection).filter(Connection.hospital_id == hospital_id).all()

    res = []
    for c in conns:
        hospital = db.query(Provider).filter(Provider.provider_id == c.hospital_id).first()
        patient = db.query(Patient).filter(Patient.id == c.patient_id).first()
        
        c_out = ConnectionOut.model_validate(c)
        if hospital: c_out.hospital_name = hospital.name
        if patient:
            c_out.patient_name = patient.name
            c_out.patient_code = patient.patient_code
        res.append(c_out)
    return res
