from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
import datetime

# User & Auth Schemas
class PatientRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    age: int
    gender: str
    district: str
    pincode: Optional[str] = ""
    language_preference: Optional[str] = "en"

class HospitalRegisterRequest(BaseModel):
    hospital_name: str
    provider_id: Optional[str] = None # Existing dataset provider_id if selected
    staff_name: str
    email: EmailStr
    password: str
    facility_type: Optional[str] = "Hospital"
    ownership: Optional[str] = "Private"
    district: Optional[str] = "Chennai"

class AddReviewerRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    email: str
    user_id: int
    user_code: str # Patient ID (PAT-000123) or Hospital ID (HOS-000045)
    hospital_id: Optional[str] = None
    patient_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    user_code: Optional[str] = ""
    hospital_id: Optional[str] = None
    patient_id: Optional[int] = None
    language_preference: Optional[str] = "en"
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# Provider / Hospital Schemas
class ProviderOut(BaseModel):
    provider_id: str
    name: str
    facility_type: str
    ownership: str
    systems_of_medicine: str
    specialties: str
    address: str
    district: str
    state: str
    pincode: str
    phone: str
    public_email: str
    website: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coord_source: str
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True

# Patient Schemas
class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    email: str
    phone: Optional[str] = ""
    district: str
    pincode: Optional[str] = ""
    language_preference: Optional[str] = "en"

class PatientOut(BaseModel):
    id: int
    patient_code: str
    name: str
    age: int
    gender: str
    email: str
    phone: str
    district: str
    pincode: str
    hospital_id: Optional[str] = None
    language_preference: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Privacy Masked Search Result for Hospital "Find Patients"
class PatientSearchResult(BaseModel):
    id: int
    patient_code: str
    name: str
    masked_email: str
    district: str
    connection_status: str # not_connected, pending, accepted, declined, revoked
    connection_id: Optional[int] = None

# Connection Schemas
class SendConnectionRequest(BaseModel):
    patient_id: int
    message: Optional[str] = "You were treated at our hospital. We would like to coordinate your post-discharge follow-up care."

class ConnectionActionRequest(BaseModel):
    action: str # accept, decline, revoke, cancel

class ConnectionOut(BaseModel):
    id: int
    hospital_id: str
    hospital_name: Optional[str] = None
    patient_id: int
    patient_name: Optional[str] = None
    patient_code: Optional[str] = None
    status: str
    message: str
    requested_at: datetime.datetime
    responded_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# Discharge Summary Upload
class DischargeUploadRequest(BaseModel):
    patient_id: int
    raw_text: str
    confirm_mismatch: Optional[bool] = False

# Task Schemas
class TaskOut(BaseModel):
    id: int
    chart_id: int
    patient_id: int
    hospital_id: str
    title: str
    category: str
    instruction_text: str
    simple_text: str
    simple_ta: Optional[str] = None
    simple_hi: Optional[str] = None
    evidence_sentence: Optional[str] = None
    evidence_field: Optional[str] = None
    confidence_score: float = 0.9
    due_date: Optional[str] = None
    relative_days: Optional[int] = None
    depends_on_step_id: Optional[int] = None
    time_window: Optional[str] = None
    department: Optional[str] = None
    notes: Optional[str] = None
    order_index: int = 0
    source: str = "manual"
    needs_review: bool = False
    status: str
    scheduled_hospital_id: Optional[str] = None
    scheduled_doctor_id: Optional[int] = None
    scheduled_slot_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    reviewer_notes: Optional[str] = None
    requires_document: bool = False
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

class TaskReviewRequest(BaseModel):
    action: str # approve, edit, reject
    simple_text: Optional[str] = None
    due_date: Optional[str] = None
    reviewer_notes: Optional[str] = None

# Followup Chart Schema
class FollowupChartOut(BaseModel):
    id: int
    patient_id: int
    hospital_id: str
    status: str = "Draft"
    discharge_date: Optional[str] = None
    version: int = 1
    created_by: Optional[int] = None
    is_published: bool = False
    published_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    hospital_name: Optional[str] = None
    analysis_report: Optional[dict] = None
    tasks: List[TaskOut] = []

    class Config:
        from_attributes = True

# Doctor & Availability Slots
class DoctorCreate(BaseModel):
    name: str
    department: str
    specialty: Optional[str] = "General Medicine"

class DoctorOut(BaseModel):
    id: int
    hospital_id: str
    name: str
    department: str
    specialty: str

    class Config:
        from_attributes = True

class SlotOut(BaseModel):
    id: int
    doctor_id: int
    hospital_id: str
    date: str
    start_time: str
    end_time: str
    is_booked: bool
    doctor_name: Optional[str] = None
    doctor_department: Optional[str] = None

    class Config:
        from_attributes = True

# Booking Requests
class BookingCreateRequest(BaseModel):
    task_id: int
    hospital_id: str
    doctor_id: int
    slot_id: int

class BookingOut(BaseModel):
    id: int
    patient_id: int
    task_id: int
    hospital_id: str
    doctor_id: int
    slot_id: int
    status: str
    created_at: datetime.datetime
    hospital_name: Optional[str] = None
    doctor_name: Optional[str] = None
    slot_date: Optional[str] = None
    slot_time: Optional[str] = None

    class Config:
        from_attributes = True

# Documents
class DocumentOut(BaseModel):
    id: int
    patient_id: int
    hospital_id: str
    chart_id: Optional[int] = None
    step_id: Optional[int] = None
    task_id: Optional[int] = None
    file_name: str
    file_url: str
    document_type: str
    mime_type: Optional[str] = "application/pdf"
    file_size: Optional[int] = 0
    uploaded_at: datetime.datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

# Notifications
class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Email Outbox
class OutboxEmailOut(BaseModel):
    id: int
    recipient_email: str
    recipient_name: str
    subject: str
    body_html: str
    token_accept: Optional[str] = None
    token_decline: Optional[str] = None
    booking_request_id: Optional[int] = None
    status: str
    error_message: Optional[str] = None
    sent_at: datetime.datetime

    class Config:
        from_attributes = True

# Feedback
class FeedbackCreate(BaseModel):
    rating: int
    comment: Optional[str] = ""
    task_id: Optional[int] = None
    doctor_id: Optional[int] = None
    department: Optional[str] = "General"
    source: Optional[str] = "appointment"

class FeedbackOut(BaseModel):
    id: int
    patient_id: int
    hospital_id: str
    doctor_id: Optional[int] = None
    department: str
    rating: int
    comment: str
    source: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Chatbot
class ChatQuery(BaseModel):
    query: str
    language: Optional[str] = "en"

class CitationItem(BaseModel):
    source_type: str # second_brain, patient_record, task, document
    title: str
    snippet: str
    url_or_path: Optional[str] = None

class ChatResponse(BaseModel):
    query: str
    answer: str
    citations: List[CitationItem] = []
    requires_human_review: bool = False
    suggested_actions: Optional[List[str]] = []
    offline_fallback: Optional[bool] = False
    chat_history_id: Optional[int] = None
    detected_language: Optional[str] = "en"
    classified_category: Optional[str] = "in_scope"

# Second Brain
class SecondBrainNodeOut(BaseModel):
    id: int
    path: str
    title: str
    category: str
    content: str
    wikilinks: List[str] = []
    hospital_id: Optional[str] = None
    patient_id: Optional[int] = None
    visibility: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# Extended Chart Builder Schemas
class ChartStepCreate(BaseModel):
    title: str
    category: Optional[str] = "appointment"
    type: Optional[str] = None # Alias for UI type
    instruction_text: Optional[str] = ""
    instructions: Optional[str] = None
    simple_text: Optional[str] = None
    due_date: Optional[str] = None # YYYY-MM-DD
    relative_days: Optional[int] = None
    depends_on_step_id: Optional[int] = None
    time_window: Optional[str] = None
    department: Optional[str] = None
    doctor_id: Optional[int] = None
    notes: Optional[str] = None
    order_index: Optional[int] = 0
    source: Optional[str] = "manual"
    needs_review: Optional[bool] = False

class ChartStepOut(BaseModel):
    id: int
    chart_id: int
    patient_id: int
    hospital_id: str
    title: str
    category: str
    instruction_text: str
    simple_text: str
    due_date: Optional[str] = None
    relative_days: Optional[int] = None
    depends_on_step_id: Optional[int] = None
    time_window: Optional[str] = None
    department: Optional[str] = None
    notes: Optional[str] = None
    order_index: int = 0
    source: str = "manual"
    needs_review: bool = False
    status: str

    class Config:
        from_attributes = True

class ChartCreateRequest(BaseModel):
    patient_id: int
    discharge_date: Optional[str] = None
    steps: List[ChartStepCreate]
    source: Optional[str] = "manual"
    template_name: Optional[str] = None

class ChartUpdateRequest(BaseModel):
    discharge_date: Optional[str] = None
    steps: List[ChartStepCreate]

class ChartReviewStatusRequest(BaseModel):
    status: str # Draft, In Review, Approved

class ChartTemplateOut(BaseModel):
    id: int
    hospital_id: Optional[str] = None
    name: str
    problem_tags: Any = []
    steps: Any = []
    is_sample: bool = True
    disclaimer: Optional[str] = "Sample template, hospital must confirm clinical content."
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class ChartTemplateCreate(BaseModel):
    name: str
    problem_tags: List[str] = []
    steps: List[dict] = []

class ChartAutoGenerateRequest(BaseModel):
    patient_id: int
    problem_tags: List[str] = []
    custom_problem: Optional[str] = None
    discharge_date: Optional[str] = None
    discharge_summary_text: Optional[str] = None

# Email Log & Action Schemas
class EmailLogOut(BaseModel):
    id: int
    recipient_email: str
    recipient_name: Optional[str] = ""
    subject: str
    email_type: str
    status: str
    error_message: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class EmailActionDetailsOut(BaseModel):
    token: str
    action_type: str
    is_used: bool
    is_expired: bool
    patient_name: str
    patient_code: str
    hospital_name: str
    hospital_district: str
    doctor_name: Optional[str] = ""
    department: Optional[str] = ""
    date_slot: Optional[str] = ""
    time_slot: Optional[str] = ""
    status: str

class EmailActionSubmit(BaseModel):
    action: str # accept, decline

class PatientQueryCreate(BaseModel):
    task_id: Optional[int] = None
    question_text: str

class PatientQueryReply(BaseModel):
    reply_text: str

class PatientQueryOut(BaseModel):
    id: int
    patient_id: int
    patient_name: Optional[str] = ""
    patient_code: Optional[str] = ""
    task_id: Optional[int] = None
    question_text: str
    status: str
    hospital_reply: Optional[str] = None
    replied_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True
