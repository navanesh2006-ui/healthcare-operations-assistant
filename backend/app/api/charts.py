import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import FollowupChart, Task, Patient, Provider, Connection, AuditLog, Notification, ChartTemplate, ChartVersion, User
from app.schemas import (
    ChartCreateRequest, ChartUpdateRequest, ChartReviewStatusRequest, ChartAutoGenerateRequest,
    ChartTemplateOut, ChartTemplateCreate, FollowupChartOut, TaskOut
)
from app.security import get_current_user_data, require_role
from app.services.email_service import send_real_email

router = APIRouter(prefix="/api/charts", tags=["Charts"])

@router.get("/templates", response_model=List[ChartTemplateOut])
def get_chart_templates(
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    templates = db.query(ChartTemplate).filter(
        (ChartTemplate.hospital_id == None) | (ChartTemplate.hospital_id == h_id)
    ).order_by(ChartTemplate.is_sample.desc(), ChartTemplate.id.asc()).all()
    return templates

@router.post("/templates", response_model=ChartTemplateOut)
def save_custom_template(
    req: ChartTemplateCreate,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    t = ChartTemplate(
        hospital_id=h_id,
        name=req.name.strip(),
        problem_tags=req.problem_tags,
        steps=req.steps,
        is_sample=False,
        disclaimer="Custom hospital template created by staff."
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

def get_category_priority_rank(category: str = "", title: str = "", step_type: str = "") -> int:
    cat = (category or step_type or "").lower()
    t = (title or "").lower()
    if "warning" in cat or "warning" in t or "emergency" in t or "red flag" in t:
        return 1
    if "medicine" in cat or "therapy" in cat or "therapy" in t or "antimicrobial" in t or "antibiotic" in t or "medication" in t:
        return 2
    if "test" in cat or "lab" in cat or "blood" in t or "pathology" in t:
        return 3
    if "scan" in cat or "imaging" in cat or "x-ray" in t or "ultrasound" in t:
        return 4
    if "appointment" in cat or "checkup" in cat or "consultation" in t:
        return 5
    if "care" in cat or "hydration" in t or "rest" in t or "wound" in t:
        return 6
    return 7

def sort_steps_key(step):
    rel_days = step.get("relative_days")
    if rel_days is None:
        rel_days = 999
    due_date = step.get("due_date") or "9999-99-99"
    cat = step.get("category") or step.get("type") or ""
    title = step.get("title") or ""
    stype = step.get("type") or ""
    rank = get_category_priority_rank(cat, title, stype)
    return (rel_days, due_date, rank, title)

@router.post("/auto-generate")
def auto_generate_chart_draft(
    req: ChartAutoGenerateRequest,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    
    # 1. Connection enforcement: Return 403 if patient is not connected to hospital
    conn = db.query(Connection).filter(
        Connection.hospital_id == h_id,
        Connection.patient_id == req.patient_id,
        Connection.status == "accepted"
    ).first()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital is not connected to this patient. Send a connection request and wait for patient consent before creating a chart."
        )

    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    discharge_dt_str = req.discharge_date or datetime.date.today().isoformat()
    try:
        base_date = datetime.date.fromisoformat(discharge_dt_str)
    except Exception:
        base_date = datetime.date.today()

    matched_steps = []
    template_names = []

    # Query matching templates
    if req.problem_tags:
        templates = db.query(ChartTemplate).filter(
            (ChartTemplate.hospital_id == None) | (ChartTemplate.hospital_id == h_id)
        ).all()
        
        for t in templates:
            # Check tag overlap or name match
            tags_lower = [str(tag).lower() for tag in (t.problem_tags or [])] + [t.name.lower()]
            if any(p.lower() in ' '.join(tags_lower) for p in req.problem_tags):
                template_names.append(t.name)
                for step in t.steps:
                    rel_days = step.get("relative_days", 1)
                    calc_date = (base_date + datetime.timedelta(days=rel_days)).isoformat()
                    step_copy = dict(step)
                    text_val = step.get("instructions") or step.get("instruction_text") or ""
                    step_copy["due_date"] = calc_date
                    step_copy["instruction_text"] = text_val
                    step_copy["instructions"] = text_val
                    step_copy["source"] = "template"
                    step_copy["template_name"] = t.name
                    matched_steps.append(step_copy)

    # Custom problem handling
    if req.custom_problem or not matched_steps:
        cp_name = req.custom_problem or "Custom Follow-up Care"
        template_names.append(cp_name)
        default_steps = [
            {
                "type": "Warning signs",
                "title": "Emergency Red Flags",
                "category": "warning_sign",
                "relative_days": 1,
                "due_date": (base_date + datetime.timedelta(days=1)).isoformat(),
                "instructions": "Report sudden worsening of symptoms, high fever, or severe pain immediately.",
                "source": "template",
                "template_name": cp_name,
                "needs_review": False
            },
            {
                "type": "Care instruction",
                "title": "Home Recovery & Symptom Tracking",
                "category": "care_instruction",
                "relative_days": 1,
                "due_date": (base_date + datetime.timedelta(days=1)).isoformat(),
                "instructions": f"Follow rest protocol and track daily symptoms for {cp_name}.",
                "source": "template",
                "template_name": cp_name,
                "needs_review": False
            },
            {
                "type": "Check-up / Appointment",
                "title": f"Follow-up Consultation for {cp_name}",
                "category": "appointment",
                "relative_days": 7,
                "due_date": (base_date + datetime.timedelta(days=7)).isoformat(),
                "instructions": f"Outpatient consultation for {cp_name} evaluation and progress review.",
                "source": "template",
                "template_name": cp_name,
                "needs_review": False
            }
        ]
        matched_steps.extend(default_steps)

    # Deduplicate steps by title if multiple templates merged
    unique_steps = []
    seen_titles = set()
    for s in matched_steps:
        text_val = s.get("instruction_text") or s.get("instructions") or ""
        s["instruction_text"] = text_val
        s["instructions"] = text_val
        if s["title"] not in seen_titles:
            seen_titles.add(s["title"])
            if s.get("category") == "medicine" or "medicine" in s.get("type", "").lower() or "dose" in text_val.lower():
                s["needs_review"] = True
            unique_steps.append(s)

    # Sort steps by relative_days / due_date ascending and urgency priority
    unique_steps.sort(key=sort_steps_key)

    # Auto-stagger duplicate dates across non-warning steps to prevent date collisions
    seen_dates = set()
    staggered_steps = []
    for s in unique_steps:
        cat = (s.get("category") or s.get("type") or "").lower()
        title = (s.get("title") or "").lower()
        is_warn = "warning" in cat or "warning" in title or "emergency" in title
        rel_days = s.get("relative_days") or 1
        calc_due = (base_date + datetime.timedelta(days=rel_days)).isoformat()

        if not is_warn:
            while calc_due in seen_dates:
                rel_days += 1
                calc_due = (base_date + datetime.timedelta(days=rel_days)).isoformat()

        seen_dates.add(calc_due)
        s["relative_days"] = rel_days
        s["due_date"] = calc_due
        staggered_steps.append(s)

    return {
        "patient_id": req.patient_id,
        "patient_name": patient.name,
        "patient_code": patient.patient_code,
        "discharge_date": base_date.isoformat(),
        "templates_used": list(set(template_names)),
        "disclaimer": "This tool organizes follow-up tasks. It does not diagnose or recommend treatment. Clinical staff must confirm all content.",
        "steps": staggered_steps
    }

@router.post("/create", response_model=FollowupChartOut)
def create_chart_draft(
    req: ChartCreateRequest,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]

    # 1. Connection check: return 403 Forbidden if not connected
    conn = db.query(Connection).filter(
        Connection.hospital_id == h_id,
        Connection.patient_id == req.patient_id,
        Connection.status == "accepted"
    ).first()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hospital is not connected to this patient. Consent is required before chart creation."
        )

    patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    discharge_dt = req.discharge_date or datetime.date.today().isoformat()

    # Find existing draft chart or create new chart
    chart = db.query(FollowupChart).filter(
        FollowupChart.patient_id == req.patient_id,
        FollowupChart.hospital_id == h_id
    ).order_by(FollowupChart.id.desc()).first()

    if not chart:
        chart = FollowupChart(
            patient_id=req.patient_id,
            hospital_id=h_id,
            status="Draft",
            discharge_date=discharge_dt,
            version=1,
            created_by=current_user["user_id"],
            is_published=False
        )
        db.add(chart)
        db.flush()
    # Fetch existing tasks for this chart to preserve patient completed/scheduled statuses
    existing_tasks = db.query(Task).filter(Task.chart_id == chart.id).all() if chart.id else []
    existing_task_map = { t.title.strip().lower(): t for t in existing_tasks }
    updated_task_ids = set()

    # Add steps sorted by deadline & priority rank
    steps_data = [s.model_dump() for s in req.steps]
    steps_data.sort(key=sort_steps_key)

    for idx, s_dict in enumerate(steps_data):
        title_key = s_dict["title"].strip().lower()
        existing_t = existing_task_map.get(title_key)

        cat = s_dict.get("category") or s_dict.get("type") or "appointment"
        cat_clean = cat.lower().replace(" ", "_").replace("/", "_")
        if "check" in cat_clean or "appointment" in cat_clean: cat_val = "appointment"
        elif "scan" in cat_clean or "imaging" in cat_clean: cat_val = "scan"
        elif "lab" in cat_clean or "test" in cat_clean: cat_val = "test"
        elif "referral" in cat_clean: cat_val = "referral"
        elif "medicine" in cat_clean: cat_val = "medicine"
        elif "care" in cat_clean: cat_val = "care_instruction"
        elif "warning" in cat_clean: cat_val = "warning_sign"
        else: cat_val = "other"

        simple_text = s_dict.get("simple_text") or s_dict.get("instruction_text")

        if existing_t:
            existing_t.category = cat_val
            existing_t.instruction_text = s_dict["instruction_text"]
            existing_t.simple_text = simple_text
            existing_t.due_date = s_dict.get("due_date")
            existing_t.relative_days = s_dict.get("relative_days")
            existing_t.depends_on_step_id = s_dict.get("depends_on_step_id")
            existing_t.time_window = s_dict.get("time_window")
            existing_t.department = s_dict.get("department")
            existing_t.notes = s_dict.get("notes")
            existing_t.order_index = idx
            updated_task_ids.add(existing_t.id)
        else:
            t = Task(
                chart_id=chart.id,
                patient_id=req.patient_id,
                hospital_id=h_id,
                title=s_dict["title"],
                category=cat_val,
                instruction_text=s_dict["instruction_text"],
                simple_text=simple_text,
                due_date=s_dict.get("due_date"),
                relative_days=s_dict.get("relative_days"),
                depends_on_step_id=s_dict.get("depends_on_step_id"),
                time_window=s_dict.get("time_window"),
                department=s_dict.get("department"),
                notes=s_dict.get("notes"),
                order_index=idx,
                source=s_dict.get("source") or req.source or "manual",
                needs_review=s_dict.get("needs_review") if s_dict.get("needs_review") is not None else (cat_val == "medicine"),
                status="Pending"
            )
            db.add(t)

    # Delete only tasks that were explicitly removed by staff and are not Completed
    for et in existing_tasks:
        if et.id not in updated_task_ids and et.status != "Completed":
            db.delete(et)

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="CREATE_CHART_DRAFT",
        entity_type="FollowupChart",
        entity_id=str(chart.id),
        details=f"Created/updated draft chart with {len(req.steps)} steps for {patient.name} ({patient.patient_code})"
    )
    db.add(audit)
    db.commit()
    db.refresh(chart)

    provider = db.query(Provider).filter(Provider.provider_id == h_id).first()
    c_out = FollowupChartOut.model_validate(chart)
    if provider: c_out.hospital_name = provider.name
    return c_out

@router.get("/{chart_id}", response_model=FollowupChartOut)
def get_chart_by_id(
    chart_id: int,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    chart = db.query(FollowupChart).filter(FollowupChart.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    provider = db.query(Provider).filter(Provider.provider_id == chart.hospital_id).first()
    c_out = FollowupChartOut.model_validate(chart)
    if provider: c_out.hospital_name = provider.name
    return c_out

@router.put("/{chart_id}", response_model=FollowupChartOut)
def update_chart(
    chart_id: int,
    req: ChartUpdateRequest,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    chart = db.query(FollowupChart).filter(
        FollowupChart.id == chart_id,
        FollowupChart.hospital_id == h_id
    ).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    patient = db.query(Patient).filter(Patient.id == chart.patient_id).first()
    was_published = chart.is_published

    # If chart was already published, create a new version snapshot before editing
    if was_published:
        existing_tasks = [
            {
                "id": t.id,
                "title": t.title,
                "category": t.category,
                "instruction_text": t.instruction_text,
                "simple_text": t.simple_text,
                "due_date": t.due_date,
                "status": t.status
            } for t in chart.tasks
        ]
        snapshot = {
            "chart_id": chart.id,
            "version": chart.version,
            "discharge_date": chart.discharge_date,
            "tasks": existing_tasks
        }
        ver = ChartVersion(
            chart_id=chart.id,
            version_number=chart.version,
            snapshot=snapshot,
            created_by=current_user["user_id"]
        )
        db.add(ver)
        chart.version += 1
        chart.updated_at = datetime.datetime.utcnow()

    if req.discharge_date:
        chart.discharge_date = req.discharge_date

    # Preserve existing tasks for this chart
    existing_tasks = db.query(Task).filter(Task.chart_id == chart.id).all()
    existing_task_map = { t.title.strip().lower(): t for t in existing_tasks }
    updated_task_ids = set()

    steps_data = [s.model_dump() for s in req.steps]
    steps_data.sort(key=sort_steps_key)

    for idx, s_dict in enumerate(steps_data):
        title_key = s_dict["title"].strip().lower()
        existing_t = existing_task_map.get(title_key)

        cat = s_dict.get("category") or s_dict.get("type") or "appointment"
        cat_clean = cat.lower().replace(" ", "_").replace("/", "_")
        if "check" in cat_clean or "appointment" in cat_clean: cat_val = "appointment"
        elif "scan" in cat_clean or "imaging" in cat_clean: cat_val = "scan"
        elif "lab" in cat_clean or "test" in cat_clean: cat_val = "test"
        elif "referral" in cat_clean: cat_val = "referral"
        elif "medicine" in cat_clean: cat_val = "medicine"
        elif "care" in cat_clean: cat_val = "care_instruction"
        elif "warning" in cat_clean: cat_val = "warning_sign"
        else: cat_val = "other"

        simple_text = s_dict.get("simple_text") or s_dict.get("instruction_text")

        if existing_t:
            existing_t.category = cat_val
            existing_t.instruction_text = s_dict["instruction_text"]
            existing_t.simple_text = simple_text
            existing_t.due_date = s_dict.get("due_date")
            existing_t.relative_days = s_dict.get("relative_days")
            existing_t.depends_on_step_id = s_dict.get("depends_on_step_id")
            existing_t.time_window = s_dict.get("time_window")
            existing_t.department = s_dict.get("department")
            existing_t.notes = s_dict.get("notes")
            existing_t.order_index = idx
            updated_task_ids.add(existing_t.id)
        else:
            t = Task(
                chart_id=chart.id,
                patient_id=chart.patient_id,
                hospital_id=h_id,
                title=s_dict["title"],
                category=cat_val,
                instruction_text=s_dict["instruction_text"],
                simple_text=simple_text,
                due_date=s_dict.get("due_date"),
                relative_days=s_dict.get("relative_days"),
                depends_on_step_id=s_dict.get("depends_on_step_id"),
                time_window=s_dict.get("time_window"),
                department=s_dict.get("department"),
                notes=s_dict.get("notes"),
                order_index=idx,
                source=s_dict.get("source") or "manual",
                needs_review=s_dict.get("needs_review") if s_dict.get("needs_review") is not None else (cat_val == "medicine"),
                status="Pending"
            )
            db.add(t)

    # Delete only tasks that were explicitly removed by staff and are not Completed
    for et in existing_tasks:
        if et.id not in updated_task_ids and et.status != "Completed":
            db.delete(et)

    # If chart was already published, notify patient of the update
    if was_published and patient:
        p_users = db.query(User).filter(User.patient_id == patient.id).all()
        for pu in p_users:
            notif = Notification(
                user_id=pu.id,
                title="Follow-up Chart Updated",
                message=f"Your hospital updated your follow-up care chart ({len(req.steps)} steps updated).",
                type="info"
            )
            db.add(notif)

        email_body = f"""
        <div style="padding: 10px;">
            <h3 style="color: #4CAF50; margin-top: 0;">CareBridge: Follow-up Care Chart Updated</h3>
            <p>Dear {patient.name},</p>
            <p>Your healthcare provider has updated your post-discharge follow-up schedule (Version {chart.version}).</p>
            <p>Please log in to your Patient Portal to review your updated follow-up tasks.</p>
        </div>
        """
        send_real_email(
            db=db,
            recipient_email=patient.email,
            recipient_name=patient.name,
            subject=f"CareBridge: Follow-up Chart Updated (v{chart.version})",
            body_html=email_body,
            email_type="chart_updated"
        )

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="UPDATE_CHART",
        entity_type="FollowupChart",
        entity_id=str(chart.id),
        details=f"Updated chart #{chart.id} (v{chart.version}) with {len(req.steps)} steps"
    )
    db.add(audit)
    db.commit()
    db.refresh(chart)

    provider = db.query(Provider).filter(Provider.provider_id == h_id).first()
    c_out = FollowupChartOut.model_validate(chart)
    if provider: c_out.hospital_name = provider.name
    return c_out

@router.post("/{chart_id}/review-status", response_model=FollowupChartOut)
def update_chart_review_status(
    chart_id: int,
    req: ChartReviewStatusRequest,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    chart = db.query(FollowupChart).filter(
        FollowupChart.id == chart_id,
        FollowupChart.hospital_id == h_id
    ).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    new_status = req.status.strip()
    if new_status not in ["Draft", "In Review", "Approved"]:
        raise HTTPException(status_code=400, detail="Invalid review status")

    chart.status = new_status
    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action=f"CHART_STATUS_{new_status.upper().replace(' ', '_')}",
        entity_type="FollowupChart",
        entity_id=str(chart.id),
        details=f"Changed chart #{chart.id} status to {new_status}"
    )
    db.add(audit)
    db.commit()
    db.refresh(chart)

    provider = db.query(Provider).filter(Provider.provider_id == h_id).first()
    c_out = FollowupChartOut.model_validate(chart)
    if provider: c_out.hospital_name = provider.name
    return c_out

@router.post("/{chart_id}/publish", response_model=FollowupChartOut)
def publish_chart(
    chart_id: int,
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    h_id = current_user["hospital_id"]
    chart = db.query(FollowupChart).filter(
        FollowupChart.id == chart_id,
        FollowupChart.hospital_id == h_id
    ).first()

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    patient = db.query(Patient).filter(Patient.id == chart.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    provider = db.query(Provider).filter(Provider.provider_id == h_id).first()
    h_name = provider.name if provider else h_id

    # Publish Guard: Cannot publish chart if any step needs review
    flagged_tasks = [t for t in chart.tasks if t.needs_review or t.status == "Needs Review"]
    if flagged_tasks:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish chart until all flagged steps are reviewed and confirmed by staff. {len(flagged_tasks)} step(s) pending review."
        )

    # Auto-approve if publishing directly
    chart.status = "Published"
    chart.is_published = True
    chart.published_at = datetime.datetime.utcnow()

    # In-App Notification to Patient
    p_users = db.query(User).filter(User.patient_id == patient.id).all()
    for pu in p_users:
        notif = Notification(
            user_id=pu.id,
            title="Your hospital has created a new follow-up chart",
            message=f"{h_name} has published your personalized post-discharge follow-up care schedule.",
            type="success"
        )
        db.add(notif)

    # Real Email to Patient
    email_body = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">CareBridge: Your Post-Discharge Follow-up Care Chart</h3>
        <p>Dear {patient.name},</p>
        <p><strong>{h_name}</strong> has published your personalized post-discharge follow-up schedule.</p>
        <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 14px; border-radius: 8px; margin: 12px 0;">
            <p style="margin: 0;">Your follow-up plan includes <strong>{len(chart.tasks)} tasks</strong> (appointments, scans, lab tests, care instructions).</p>
        </div>
        <p>Log in to your CareBridge Patient Portal to view your interactive follow-up timeline and book consultation slots.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=patient.email,
        recipient_name=patient.name,
        subject=f"CareBridge: New Follow-up Care Chart Published by {h_name}",
        body_html=email_body,
        email_type="chart_published"
    )

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="PUBLISH_CHART",
        entity_type="FollowupChart",
        entity_id=str(chart.id),
        details=f"Published chart #{chart.id} for {patient.name} ({patient.patient_code})"
    )
    db.add(audit)
    db.commit()
    db.refresh(chart)

    c_out = FollowupChartOut.model_validate(chart)
    if provider: c_out.hospital_name = provider.name
    return c_out

@router.post("/steps/{task_id}/confirm", response_model=TaskOut)
def confirm_chart_step(
    task_id: int,
    req: dict = Body(default={}),
    current_user: dict = Depends(require_role(["hospital_staff", "hospital_reviewer"])),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    orig_text = task.simple_text
    task.needs_review = False
    if task.status == "Needs Review":
        task.status = "Pending"
    task.confidence_score = 1.0
    task.reviewed_by = current_user.get("name", "Hospital Staff")
    task.reviewed_at = datetime.datetime.utcnow()
    task.reviewer_id = current_user["user_id"]

    simple_text = req.get("simple_text")
    if simple_text:
        task.simple_text = simple_text
    due_date = req.get("due_date")
    if due_date:
        task.due_date = due_date
    reviewer_notes = req.get("reviewer_notes")
    if reviewer_notes:
        task.reviewer_notes = reviewer_notes

    from app.services.second_brain import write_reviewer_decision_to_second_brain
    write_reviewer_decision_to_second_brain(
        db=db,
        task_id=task.id,
        reviewer_name=current_user.get("name", "Hospital Staff"),
        original_text=orig_text,
        corrected_text=task.simple_text,
        decision_reason=reviewer_notes or "Confirmed by staff in Chart Builder.",
        hospital_id=task.hospital_id,
        patient_id=task.patient_id
    )

    audit = AuditLog(
        user_id=current_user["user_id"],
        user_role=current_user["role"],
        action="CONFIRM_CHART_STEP",
        entity_type="Task",
        entity_id=str(task.id),
        details=f"Staff {current_user['name']} confirmed step #{task.id} '{task.title}'"
    )
    db.add(audit)
    db.commit()
    db.refresh(task)
    return task
