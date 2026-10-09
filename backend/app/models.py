import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False) # hospital_staff, hospital_reviewer, patient
    name = Column(String(255), nullable=False)
    hospital_id = Column(String(50), nullable=True) # References Provider.provider_id e.g. HOS-000045
    patient_id = Column(Integer, nullable=True) # References Patient.id e.g. 1
    language_preference = Column(String(10), default="en") # en, ta, hi
    is_verified = Column(Boolean, default=True)
    verification_token = Column(String(255), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Provider(Base):
    __tablename__ = "providers"

    provider_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    facility_type = Column(String(100), default="Hospital")
    ownership = Column(String(100), default="Unspecified")
    systems_of_medicine = Column(String(200), default="Unspecified")
    specialties = Column(Text, default="")
    address = Column(Text, default="")
    district = Column(String(100), index=True)
    state = Column(String(100), default="Tamil Nadu")
    pincode = Column(String(20), index=True)
    phone = Column(String(100), default="")
    public_email = Column(String(255), default="")
    website = Column(String(255), default="")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    coord_source = Column(String(100), default="approx_from_district_pincode")

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_code = Column(String(50), unique=True, index=True, nullable=False) # e.g. PAT-000123
    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(50), default="")
    district = Column(String(100), nullable=False)
    pincode = Column(String(20), default="")
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=True)
    language_preference = Column(String(10), default="en")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    discharge_summaries = relationship("DischargeSummary", back_populates="patient")
    charts = relationship("FollowupChart", back_populates="patient")

class Connection(Base):
    __tablename__ = "connections"
    __table_args__ = (UniqueConstraint("hospital_id", "patient_id", name="unique_hospital_patient_connection"),)

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    status = Column(String(50), default="pending") # pending, accepted, declined, revoked
    message = Column(Text, default="")
    requested_at = Column(DateTime, default=datetime.datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

class DischargeSummary(Base):
    __tablename__ = "discharge_summaries"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    raw_text = Column(Text, nullable=False)
    file_url = Column(String(500), nullable=True)
    status = Column(String(50), default="Processed") # Uploaded, Processing, Processed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("Patient", back_populates="discharge_summaries")

class FollowupChart(Base):
    __tablename__ = "followup_charts"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    status = Column(String(50), default="Draft") # Draft, In Review, Approved, Published
    discharge_date = Column(String(50), nullable=True) # YYYY-MM-DD
    version = Column(Integer, default=1)
    created_by = Column(Integer, nullable=True)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime, nullable=True)
    analysis_report = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    patient = relationship("Patient", back_populates="charts")
    tasks = relationship("Task", back_populates="chart", cascade="all, delete-orphan")
    versions = relationship("ChartVersion", back_populates="chart", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    chart_id = Column(Integer, ForeignKey("followup_charts.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False) # appointment, scan, test, referral, medicine, care_instruction, warning_sign, other
    instruction_text = Column(Text, nullable=False)
    simple_text = Column(Text, nullable=False)
    simple_ta = Column(Text, nullable=True)
    simple_hi = Column(Text, nullable=True)
    
    evidence_sentence = Column(Text, nullable=True)
    evidence_field = Column(String(100), nullable=True)
    confidence_score = Column(Float, default=0.9)
    
    due_date = Column(String(50), nullable=True) # YYYY-MM-DD format
    relative_days = Column(Integer, nullable=True)
    depends_on_step_id = Column(Integer, nullable=True)
    time_window = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    source = Column(String(50), default="manual") # manual, template, ai
    needs_review = Column(Boolean, default=False)
    status = Column(String(50), default="Pending") # Pending, Needs Review, Scheduled, Completed, Declined
    
    scheduled_hospital_id = Column(String(50), nullable=True)
    scheduled_doctor_id = Column(Integer, nullable=True)
    scheduled_slot_id = Column(Integer, nullable=True)
    
    reviewer_id = Column(Integer, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    requires_document = Column(Boolean, default=False)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    chart = relationship("FollowupChart", back_populates="tasks")

class ChartTemplate(Base):
    __tablename__ = "chart_templates"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String(50), nullable=True) # None for global sample templates
    name = Column(String(255), nullable=False)
    problem_tags = Column(JSON, default=list) # e.g. ["Diabetes", "Endocrinology"]
    steps = Column(JSON, default=list) # JSON array of template step dicts
    is_sample = Column(Boolean, default=True)
    disclaimer = Column(Text, default="Sample template, hospital must confirm clinical content.")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ChartVersion(Base):
    __tablename__ = "chart_versions"

    id = Column(Integer, primary_key=True, index=True)
    chart_id = Column(Integer, ForeignKey("followup_charts.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    chart = relationship("FollowupChart", back_populates="versions")

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    name = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False)
    specialty = Column(String(100), default="General Medicine")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    date = Column(String(20), nullable=False) # YYYY-MM-DD
    start_time = Column(String(20), nullable=False) # HH:MM
    end_time = Column(String(20), nullable=False) # HH:MM
    is_booked = Column(Boolean, default=False)
    booked_by_patient_id = Column(Integer, nullable=True)

class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("availability_slots.id"), nullable=False)
    
    status = Column(String(50), default="Requested") # Requested, Confirmed, Declined
    token = Column(String(255), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    chart_id = Column(Integer, ForeignKey("followup_charts.id"), nullable=True)
    step_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    task_id = Column(Integer, nullable=True)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    document_type = Column(String(100), default="Lab Report") # Lab Report, Prescription, Hospital Bill, Discharge Summary
    mime_type = Column(String(100), default="application/pdf")
    file_size = Column(Integer, default=0) # size in bytes
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), default="info")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient_email = Column(String(255), nullable=False)
    recipient_name = Column(String(255), default="")
    subject = Column(String(255), nullable=False)
    email_type = Column(String(100), default="notification")
    status = Column(String(50), default="sent") # sent, failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EmailActionToken(Base):
    __tablename__ = "email_action_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    action_type = Column(String(100), default="booking_accept_decline")
    booking_request_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PatientQuery(Base):
    __tablename__ = "patient_queries"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    question_text = Column(Text, nullable=False)
    status = Column(String(50), default="pending") # pending, answered
    hospital_reply = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    hospital_id = Column(String(50), ForeignKey("providers.provider_id"), nullable=False)
    doctor_id = Column(Integer, nullable=True)
    department = Column(String(100), default="General")
    task_id = Column(Integer, nullable=True)
    rating = Column(Integer, nullable=False) # 1-5
    comment = Column(Text, default="")
    source = Column(String(50), default="appointment") # appointment, chatbot
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_role = Column(String(50), default="system")
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=True)
    details = Column(Text, default="")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    role = Column(String(50), nullable=False)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    citations = Column(JSON, default=list)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class SecondBrainNode(Base):
    __tablename__ = "second_brain_nodes"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(500), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False) # hospitals, instruction-glossary, patient-friendly-templates, reviewer-decisions, cases, safety-rules
    content = Column(Text, nullable=False)
    wikilinks = Column(JSON, default=list) # list of link titles e.g. ["Safety Rules", "Cardiology Glossary"]
    hospital_id = Column(String(50), nullable=True)
    patient_id = Column(Integer, nullable=True)
    visibility = Column(String(50), default="public") # public, hospital_internal, patient_private
    embedding_json = Column(JSON, nullable=True) # vector as float array
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)
