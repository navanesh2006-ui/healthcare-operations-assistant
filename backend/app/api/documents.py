import os
import io
import zipfile
import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Document, Patient, Connection, AuditLog, Task, FollowupChart, Notification, User
from app.schemas import DocumentOut
from app.security import get_current_user_data, require_role

router = APIRouter(prefix="/api/documents", tags=["Documents"])

UPLOAD_DIR = "uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB limit
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

def check_patient_hospital_connection(db: Session, hospital_id: str, patient_id: int):
    conn = db.query(Connection).filter(
        Connection.hospital_id == hospital_id,
        Connection.patient_id == patient_id,
        Connection.status == "accepted"
    ).first()
    return conn is not None

@router.post("/upload", response_model=DocumentOut)
async def upload_patient_document(
    file: UploadFile = File(...),
    document_type: str = Form("Lab Report"),
    task_id: Optional[int] = Form(None),
    chart_id: Optional[int] = Form(None),
    patient_id: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    # 1. Extension / MIME validation
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{ext}'. Only PDF, JPG, and PNG files are allowed."
        )

    # 2. File size validation
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 10 MB."
        )

    # Determine mime type
    mime_type = file.content_type
    if not mime_type or mime_type == "application/octet-stream":
        if ext == ".pdf": mime_type = "application/pdf"
        elif ext in [".jpg", ".jpeg"]: mime_type = "image/jpeg"
        elif ext == ".png": mime_type = "image/png"

    # Determine patient ID and hospital ID context
    p_id = current_user.get("patient_id")
    if not p_id and patient_id:
        p_id = patient_id
    if not p_id and current_user.get("role") == "patient":
        p_obj = db.query(Patient).filter(Patient.email == current_user.get("email")).first()
        if p_obj: p_id = p_obj.id
    if not p_id:
        p_id = 1

    patient = db.query(Patient).filter(Patient.id == p_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    h_id = current_user.get("hospital_id")
    if not h_id:
        conn = db.query(Connection).filter(Connection.patient_id == p_id, Connection.status == "accepted").first()
        h_id = conn.hospital_id if conn else "HOS-000001"

    # Authorization Check: if hospital uploading for patient, ensure connected
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        if not check_patient_hospital_connection(db, current_user["hospital_id"], p_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Hospital is not connected to this patient."
            )
        h_id = current_user["hospital_id"]

    # Locate task and chart
    step_id = task_id
    target_chart_id = chart_id
    step_title = "Follow-up Step"
    if task_id:
        t_obj = db.query(Task).filter(Task.id == task_id).first()
        if t_obj:
            target_chart_id = t_obj.chart_id
            step_title = t_obj.title
            t_obj.status = "Completed"

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_location = os.path.join(UPLOAD_DIR, f"{int(datetime.datetime.utcnow().timestamp())}_{file.filename}")
    with open(file_location, "wb") as f:
        f.write(contents)

    doc = Document(
        patient_id=p_id,
        hospital_id=h_id,
        chart_id=target_chart_id,
        step_id=step_id,
        task_id=task_id,
        file_name=file.filename,
        file_url=f"/api/documents/file/{file.filename}",
        document_type=document_type,
        mime_type=mime_type,
        file_size=len(contents)
    )
    db.add(doc)

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="UPLOAD_DOCUMENT",
        entity_type="Document",
        entity_id=file.filename,
        details=f"Uploaded {document_type} ({len(contents)} bytes) for patient {patient.name} ({patient.patient_code})"
    )
    db.add(audit)

    # In-app notifications to hospital users
    h_users = db.query(User).filter(User.hospital_id == h_id).all()
    for hu in h_users:
        n = Notification(
            user_id=hu.id,
            title="New Patient Document Uploaded",
            message=f"{patient.name} uploaded '{file.filename}' ({document_type}) for '{step_title}'.",
            type="info"
        )
        db.add(n)

    db.commit()
    db.refresh(doc)
    doc.file_url = f"/api/documents/{doc.id}/view"

    # Real Email notification to hospital email (gmhospital1980@gmail.com)
    if current_user["role"] == "patient":
        from app.config import settings
        from app.services.email_service import send_real_email
        doc_body = f"""
        <div style="padding: 10px;">
            <h3 style="color: #4CAF50; margin-top: 0;">New Patient Document Uploaded</h3>
            <p>Patient <strong>{patient.name}</strong> (ID: <span style="font-family: monospace; color: #8BC34A;">{patient.patient_code}</span>) has uploaded a document:</p>
            <ul>
                <li><strong>Step:</strong> {step_title}</li>
                <li><strong>Document Type:</strong> {document_type}</li>
                <li><strong>File Name:</strong> {file.filename}</li>
                <li><strong>Size:</strong> {round(len(contents)/1024, 1)} KB</li>
            </ul>
        </div>
        """
        send_real_email(
            db=db,
            recipient_email=settings.HOSPITAL_DEMO_EMAIL,
            recipient_name="Hospital Coordinator",
            subject=f"[CareBridge Document] {patient.name} uploaded {file.filename} for {step_title}",
            body_html=doc_body,
            email_type="document_uploaded",
            is_hospital_target=True
        )

    return doc

@router.get("/summary")
def get_documents_summary(
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    conns = db.query(Connection).filter(Connection.hospital_id == h_id, Connection.status == "accepted").all()
    
    result = []
    for conn in conns:
        patient = db.query(Patient).filter(Patient.id == conn.patient_id).first()
        if not patient: continue

        chart = db.query(FollowupChart).filter(
            FollowupChart.patient_id == patient.id,
            FollowupChart.hospital_id == h_id
        ).order_by(FollowupChart.id.desc()).first()

        doc_expecting_categories = ["scan", "test", "medicine", "appointment", "referral"]
        tasks = chart.tasks if chart else []
        req_tasks = [t for t in tasks if t.requires_document or t.category in doc_expecting_categories]
        total_required = len(req_tasks)

        docs = db.query(Document).filter(Document.patient_id == patient.id, Document.hospital_id == h_id).all()
        uploaded_task_ids = set([d.step_id or d.task_id for d in docs if (d.step_id or d.task_id)])
        
        uploaded_count = len([t for t in req_tasks if t.id in uploaded_task_ids])
        if not req_tasks and docs:
            uploaded_count = len(docs)

        last_doc = db.query(Document).filter(
            Document.patient_id == patient.id,
            Document.hospital_id == h_id
        ).order_by(Document.uploaded_at.desc()).first()
        
        last_upload_date = last_doc.uploaded_at.isoformat() if last_doc else None

        result.append({
            "patient_id": patient.id,
            "patient_code": patient.patient_code,
            "name": patient.name,
            "chart_status": chart.status if chart else "No Chart",
            "total_required": total_required,
            "uploaded_count": uploaded_count,
            "last_upload_date": last_upload_date
        })

    return result

@router.get("/patient/{patient_id}/details")
def get_patient_document_details(
    patient_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    # Enforce authorization
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        if not check_patient_hospital_connection(db, h_id, patient_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Hospital is not connected to this patient."
            )
    elif current_user["role"] == "patient":
        if current_user.get("patient_id") != patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Patients can only view their own document records."
            )
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    chart = db.query(FollowupChart).filter(FollowupChart.patient_id == patient_id).order_by(FollowupChart.id.desc()).first()
    tasks = chart.tasks if chart else []
    
    docs = db.query(Document).filter(Document.patient_id == patient_id).all()
    doc_map = {}
    for d in docs:
        key = d.step_id or d.task_id
        if key not in doc_map:
            doc_map[key] = []
        doc_map[key].append({
            "id": d.id,
            "file_name": d.file_name,
            "file_url": f"/api/documents/{d.id}/view",
            "download_url": f"/api/documents/{d.id}/download",
            "document_type": d.document_type,
            "mime_type": d.mime_type,
            "file_size": d.file_size,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "reviewed_by": d.reviewed_by,
            "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None
        })

    doc_expecting_categories = ["scan", "test", "medicine", "appointment", "referral"]
    steps_out = []
    for t in sorted(tasks, key=lambda x: (x.due_date or '9999-99-99', x.order_index)):
        is_req = t.requires_document or (t.category in doc_expecting_categories)
        attached_docs = doc_map.get(t.id, [])
        steps_out.append({
            "id": t.id,
            "title": t.title,
            "category": t.category,
            "due_date": t.due_date,
            "status": t.status,
            "requires_document": is_req,
            "documents": attached_docs
        })

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="VIEW_PATIENT_DOCUMENTS",
        entity_type="Patient",
        entity_id=str(patient_id),
        details=f"Viewed document step cards for patient {patient.name} ({patient.patient_code})"
    )
    db.add(audit)
    db.commit()

    return {
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
        "name": patient.name,
        "chart_id": chart.id if chart else None,
        "steps": steps_out,
        "unassigned_documents": doc_map.get(None, [])
    }

@router.post("/remind")
def remind_patient_document(
    patient_id: int = Form(...),
    step_id: int = Form(...),
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    if not check_patient_hospital_connection(db, h_id, patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Hospital is not connected to this patient."
        )

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    task = db.query(Task).filter(Task.id == step_id).first()
    step_title = task.title if task else "Follow-up Step"

    # Send real email to patient
    from app.services.email_service import send_real_email
    email_body = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">CareBridge: Document Upload Reminder</h3>
        <p>Dear {patient.name},</p>
        <p>Your healthcare provider requested that you upload a document for your step: <strong>{step_title}</strong>.</p>
        <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 14px; border-radius: 8px; margin: 12px 0;">
            <p style="margin: 0; color: #8BC34A;">Please upload your lab report, scan, or prescription to complete this step.</p>
        </div>
        <p>Log in to your CareBridge Patient Portal to complete the upload.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=patient.email,
        recipient_name=patient.name,
        subject=f"[Action Needed] Please upload document for {step_title}",
        body_html=email_body,
        email_type="document_reminder"
    )

    # In-App notification
    p_users = db.query(User).filter(User.patient_id == patient_id).all()
    for pu in p_users:
        n = Notification(
            user_id=pu.id,
            title="Document Upload Reminder",
            message=f"Please upload your document for '{step_title}'.",
            type="warning"
        )
        db.add(n)

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="REMIND_PATIENT_DOCUMENT",
        entity_type="Task",
        entity_id=str(step_id),
        details=f"Sent document upload reminder email to {patient.name} for step '{step_title}'"
    )
    db.add(audit)
    db.commit()

    return {"message": f"Reminder email and notification sent to {patient.name}."}

@router.post("/{document_id}/mark-reviewed", response_model=DocumentOut)
def mark_document_reviewed(
    document_id: int,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not check_patient_hospital_connection(db, h_id, doc.patient_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Hospital is not connected to this patient."
        )

    staff_name = current_user.get("name", "Hospital Staff")
    doc.reviewed_by = staff_name
    doc.reviewed_at = datetime.datetime.utcnow()

    if doc.step_id or doc.task_id:
        t_id = doc.step_id or doc.task_id
        task = db.query(Task).filter(Task.id == t_id).first()
        if task:
            task.reviewed_by = staff_name
            task.reviewed_at = datetime.datetime.utcnow()

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="MARK_DOCUMENT_REVIEWED",
        entity_type="Document",
        entity_id=str(doc.id),
        details=f"Staff {staff_name} marked document '{doc.file_name}' as reviewed"
    )
    db.add(audit)
    db.commit()
    db.refresh(doc)
    doc.file_url = f"/api/documents/{doc.id}/view"
    return doc

@router.get("/patient/{patient_id}/download-zip")
def download_patient_zip(
    patient_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    # Enforce 403 Forbidden check
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        if not check_patient_hospital_connection(db, h_id, patient_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Hospital is not connected to this patient."
            )
    elif current_user["role"] == "patient":
        if current_user.get("patient_id") != patient_id:
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    docs = db.query(Document).filter(Document.patient_id == patient_id).all()
    if not docs:
        raise HTTPException(status_code=404, detail="No documents uploaded for this patient.")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for d in docs:
            # Locate file on disk
            matching_file = None
            if os.path.exists(UPLOAD_DIR):
                for fname in os.listdir(UPLOAD_DIR):
                    if fname.endswith(d.file_name) or d.file_name in fname:
                        matching_file = os.path.join(UPLOAD_DIR, fname)
                        break
            if matching_file and os.path.exists(matching_file):
                zf.write(matching_file, arcname=f"{d.document_type}_{d.file_name}")

    zip_buffer.seek(0)

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="DOWNLOAD_PATIENT_ZIP",
        entity_type="Patient",
        entity_id=str(patient_id),
        details=f"Downloaded ZIP package of {len(docs)} documents for patient {patient.name}"
    )
    db.add(audit)
    db.commit()

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=Patient_{patient.patient_code}_documents.zip"}
    )

@router.get("/{document_id}/view")
def view_document_file(
    document_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Authorization Check (403 Forbidden)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        if not check_patient_hospital_connection(db, h_id, doc.patient_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Hospital is not connected to this patient."
            )
    elif current_user["role"] == "patient":
        if current_user.get("patient_id") != doc.patient_id:
            raise HTTPException(status_code=403, detail="Forbidden")

    # Locate disk file
    filePath = None
    if os.path.exists(UPLOAD_DIR):
        for fname in os.listdir(UPLOAD_DIR):
            if fname.endswith(doc.file_name) or doc.file_name in fname:
                filePath = os.path.join(UPLOAD_DIR, fname)
                break

    if not filePath or not os.path.exists(filePath):
        raise HTTPException(status_code=404, detail="File on disk not found.")

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="VIEW_DOCUMENT",
        entity_type="Document",
        entity_id=str(doc.id),
        details=f"Viewed document '{doc.file_name}'"
    )
    db.add(audit)
    db.commit()

    return FileResponse(
        filePath,
        media_type=doc.mime_type or "application/pdf",
        headers={"Content-Disposition": f"inline; filename=\"{doc.file_name}\""}
    )

@router.get("/{document_id}/download")
def download_document_file(
    document_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Authorization Check (403 Forbidden)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        if not check_patient_hospital_connection(db, h_id, doc.patient_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Hospital is not connected to this patient."
            )
    elif current_user["role"] == "patient":
        if current_user.get("patient_id") != doc.patient_id:
            raise HTTPException(status_code=403, detail="Forbidden")

    filePath = None
    if os.path.exists(UPLOAD_DIR):
        for fname in os.listdir(UPLOAD_DIR):
            if fname.endswith(doc.file_name) or doc.file_name in fname:
                filePath = os.path.join(UPLOAD_DIR, fname)
                break

    if not filePath or not os.path.exists(filePath):
        raise HTTPException(status_code=404, detail="File on disk not found.")

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="DOWNLOAD_DOCUMENT",
        entity_type="Document",
        entity_id=str(doc.id),
        details=f"Downloaded document '{doc.file_name}'"
    )
    db.add(audit)
    db.commit()

    return FileResponse(
        filePath,
        media_type="application/octet-stream",
        filename=doc.file_name,
        headers={"Content-Disposition": f"attachment; filename=\"{doc.file_name}\""}
    )

@router.get("/", response_model=List[DocumentOut])
def list_documents(
    patient_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query = db.query(Document)
    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        conns = db.query(Connection).filter(Connection.hospital_id == h_id, Connection.status == "accepted").all()
        connected_p_ids = [c.patient_id for c in conns]
        if patient_id:
            if patient_id not in connected_p_ids:
                raise HTTPException(status_code=403, detail="Forbidden: Hospital is not connected to this patient.")
            query = query.filter(Document.patient_id == patient_id)
        else:
            query = query.filter((Document.hospital_id == h_id) | (Document.patient_id.in_(connected_p_ids)))
    elif current_user["role"] == "patient":
        p_id = current_user["patient_id"]
        if patient_id and patient_id != p_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        query = query.filter(Document.patient_id == p_id)

    docs = query.order_by(Document.id.desc()).all()
    for d in docs:
        d.file_url = f"/api/documents/{d.id}/view"
    return docs
