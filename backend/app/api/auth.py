import secrets
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import User, Patient, Provider, AuditLog
from app.schemas import (
    PatientRegisterRequest, HospitalRegisterRequest, AddReviewerRequest,
    UserLogin, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, Token, UserOut
)
from app.security import (
    hash_password, verify_password, create_access_token, get_current_user_data, require_role, validate_password_strength
)
from app.services.email_service import send_real_email

router = APIRouter(prefix="/api/auth", tags=["Auth"])

def get_user_code(user: User, db: Session) -> str:
    if user.role == "patient" and user.patient_id:
        p = db.query(Patient).filter(Patient.id == user.patient_id).first()
        return p.patient_code if p else f"PAT-{user.id:06d}"
    elif user.hospital_id:
        return user.hospital_id
    return f"USR-{user.id:06d}"

@router.post("/patient/register", response_model=Token)
def register_patient(req: PatientRegisterRequest, db: Session = Depends(get_db)):
    # 1. Unique email check
    existing_user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this email address already exists.")

    # 2. Password strength validation
    valid, msg = validate_password_strength(req.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # 3. Generate Patient Code PAT-000XXX
    count = db.query(Patient).count()
    p_code = f"PAT-{count+101:06d}"

    patient = Patient(
        patient_code=p_code,
        name=req.name.strip(),
        age=req.age,
        gender=req.gender,
        email=req.email.strip().lower(),
        district=req.district.strip(),
        pincode=req.pincode.strip() if req.pincode else "",
        language_preference=req.language_preference or "en"
    )
    db.add(patient)
    db.flush()

    user = User(
        email=req.email.strip().lower(),
        password_hash=hash_password(req.password),
        role="patient",
        name=req.name.strip(),
        patient_id=patient.id,
        language_preference=req.language_preference or "en"
    )
    db.add(user)

    # Welcome email to Patient
    email_body = f"""
    <div style="padding: 10px;">
        <h2 style="color: #4CAF50; margin-top: 0;">Welcome to CareBridge, {patient.name}!</h2>
        <p>Your patient account registration is complete.</p>
        <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #9EBE9E;">Your Assigned Patient ID:</p>
            <p style="margin: 4px 0 0 0; color: #8BC34A; font-family: monospace; font-size: 20px; font-weight: bold;">{p_code}</p>
        </div>
        <p>Please share your Patient ID with your hospital care team so they can connect with your profile and coordinate your post-discharge follow-up schedule.</p>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=user.email,
        recipient_name=user.name,
        subject="Welcome to CareBridge - Your Patient ID: " + p_code,
        body_html=email_body,
        email_type="welcome"
    )

    # Admin notification to HOSPITAL_DEMO_EMAIL
    admin_body = f"""
    <div style="padding: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">New Patient Registered (Admin Notice)</h3>
        <p>A new patient account has registered on CareBridge:</p>
        <ul>
            <li><strong>Patient Name:</strong> {patient.name}</li>
            <li><strong>Patient ID:</strong> {p_code}</li>
            <li><strong>District:</strong> {patient.district}</li>
            <li><strong>Email:</strong> {patient.email}</li>
        </ul>
    </div>
    """
    send_real_email(
        db=db,
        recipient_email=settings.HOSPITAL_DEMO_EMAIL,
        recipient_name="Hospital Admin",
        subject="[CareBridge Notice] New Patient Registered: " + patient.name,
        body_html=admin_body,
        email_type="hospital_admin",
        is_hospital_target=True
    )

    audit = AuditLog(
        user_id=user.id,
        user_role="patient",
        action="PATIENT_REGISTER",
        entity_type="User",
        entity_id=str(user.id),
        details=f"Registered patient {user.name} ({p_code})"
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "name": user.name,
        "patient_id": user.patient_id,
        "user_code": p_code
    })

    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        email=user.email,
        user_id=user.id,
        user_code=p_code,
        patient_id=user.patient_id
    )

@router.post("/hospital/register", response_model=Token)
def register_hospital(req: HospitalRegisterRequest, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this work email already exists.")

    valid, msg = validate_password_strength(req.password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    # Determine provider ID
    if req.provider_id:
        provider = db.query(Provider).filter(Provider.provider_id == req.provider_id).first()
        h_id = provider.provider_id if provider else req.provider_id
    else:
        count = db.query(Provider).count()
        h_id = f"HOS-{count+101:06d}"
        provider = Provider(
            provider_id=h_id,
            name=req.hospital_name.strip(),
            facility_type=req.facility_type or "Hospital",
            ownership=req.ownership or "Private",
            district=req.district or "Chennai",
            public_email=req.email.strip().lower()
        )
        db.add(provider)
        db.flush()

    user = User(
        email=req.email.strip().lower(),
        password_hash=hash_password(req.password),
        role="hospital_staff",
        name=req.staff_name.strip(),
        hospital_id=h_id
    )
    db.add(user)

    # Welcome email for Hospital Staff
    email_body = f"""
    <div style="font-family: sans-serif; background-color: #0B1F22; color: #E6F2E6; padding: 24px; border-radius: 12px; border: 1px solid #1E4A38;">
        <h2 style="color: #4CAF50;">Welcome to CareBridge, {user.name}!</h2>
        <p>Your hospital facility staff registration is successful.</p>
        <p><strong>Hospital Facility:</strong> {req.hospital_name}</p>
        <p><strong>Assigned Hospital ID:</strong> <span style="color: #8BC34A; font-family: monospace; font-size: 16px;">{h_id}</span></p>
        <p>Use your Hospital Portal to search registered patients, request follow-up care consent, and publish discharge coordinator charts.</p>
    </div>
    """
    send_outbox_email(
        db=db,
        recipient_email=user.email,
        recipient_name=user.name,
        subject="Welcome to CareBridge - Hospital ID: " + h_id,
        body_html=email_body
    )

    audit = AuditLog(
        user_id=user.id,
        user_role="hospital_staff",
        action="HOSPITAL_REGISTER",
        entity_type="User",
        entity_id=str(user.id),
        details=f"Registered hospital staff {user.name} for {req.hospital_name} ({h_id})"
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "name": user.name,
        "hospital_id": user.hospital_id,
        "user_code": h_id
    })

    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        email=user.email,
        user_id=user.id,
        user_code=h_id,
        hospital_id=user.hospital_id
    )

@router.post("/hospital/add-reviewer", response_model=UserOut)
def add_hospital_reviewer(
    req: AddReviewerRequest,
    current_user: dict = Depends(require_role(["hospital_staff"])),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = User(
        email=req.email.strip().lower(),
        password_hash=hash_password(req.password),
        role="hospital_reviewer",
        name=req.name.strip(),
        hospital_id=current_user["hospital_id"]
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/patient/login", response_model=Token)
def login_patient(login_data: UserLogin, db: Session = Depends(get_db)):
    clean_email = login_data.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address. Please register a new Patient account.")

    if user.role != "patient":
        raise HTTPException(status_code=403, detail="This account is registered for the Hospital portal. Please use the Hospital Login.")

    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Please check your credentials or use Forgot Password.")

    u_code = get_user_code(user, db)
    token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "name": user.name,
        "patient_id": user.patient_id,
        "user_code": u_code
    })

    # Security Email on Sign-in (asynchronous background task for fast login)
    def _send_login_notice_async(user_email: str, user_name: str, code_str: str):
        try:
            from app.database import SessionLocal
            temp_db = SessionLocal()
            now_str = datetime.datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
            sec_body = f"""
            <div style="padding: 10px;">
                <h3 style="color: #4CAF50; margin-top: 0;">New Sign-in to Your CareBridge Account</h3>
                <p>Hello {user_name},</p>
                <p>A new successful sign-in to your CareBridge Patient Portal account was recorded.</p>
                <ul>
                    <li><strong>Account:</strong> {user_email} ({code_str})</li>
                    <li><strong>Time:</strong> {now_str}</li>
                </ul>
            </div>
            """
            send_real_email(
                db=temp_db,
                recipient_email=user_email,
                recipient_name=user_name,
                subject="[CareBridge Security] New Sign-in to your account",
                body_html=sec_body,
                email_type="signin_alert"
            )
            temp_db.close()
        except Exception as e:
            logger.warning(f"Sign-in email dispatch note: {e}")

    import threading
    threading.Thread(target=_send_login_notice_async, args=(user.email, user.name, u_code), daemon=True).start()

    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        email=user.email,
        user_id=user.id,
        user_code=u_code,
        patient_id=user.patient_id
    )

@router.post("/hospital/login", response_model=Token)
def login_hospital(login_data: UserLogin, db: Session = Depends(get_db)):
    clean_email = login_data.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this work email address. Please register your Hospital facility.")

    if user.role not in ["hospital_staff", "hospital_reviewer"]:
        raise HTTPException(status_code=403, detail="This account is registered for the Patient portal. Please use the Patient Login.")

    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Please check your credentials or use Forgot Password.")

    u_code = get_user_code(user, db)
    token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "name": user.name,
        "hospital_id": user.hospital_id,
        "user_code": u_code
    })

    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        email=user.email,
        user_id=user.id,
        user_code=u_code,
        hospital_id=user.hospital_id
    )

@router.post("/login", response_model=Token)
def login_universal(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email.strip().lower()).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    u_code = get_user_code(user, db)
    token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role,
        "name": user.name,
        "hospital_id": user.hospital_id,
        "patient_id": user.patient_id,
        "user_code": u_code
    })

    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        email=user.email,
        user_id=user.id,
        user_code=u_code,
        hospital_id=user.hospital_id,
        patient_id=user.patient_id
    )

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if user:
        reset_tok = secrets.token_urlsafe(16)
        user.reset_token = reset_tok
        user.reset_token_expires = datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        db.commit()

        body = f"""
        <div style="padding: 10px;">
            <h2 style="color: #4CAF50; margin-top: 0;">CareBridge Password Reset Request</h2>
            <p>Hello {user.name},</p>
            <p>You requested a password reset for your CareBridge account.</p>
            <div style="background-color: #12332B; border: 1px solid #1E4A38; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0; font-size: 13px; color: #9EBE9E;">Reset Token:</p>
                <p style="margin: 4px 0 0 0; color: #8BC34A; font-family: monospace; font-size: 18px; font-weight: bold;">{reset_tok}</p>
            </div>
            <p>Use this token to reset your password on the CareBridge portal.</p>
        </div>
        """
        send_real_email(
            db=db,
            recipient_email=user.email,
            recipient_name=user.name,
            subject="CareBridge Password Reset Token",
            body_html=body,
            email_type="password_reset"
        )
    return {"message": "If an account exists with this email, a password reset email has been sent to your inbox."}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == req.token).first()
    if not user or (user.reset_token_expires and user.reset_token_expires < datetime.datetime.utcnow()):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    valid, msg = validate_password_strength(req.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    user.password_hash = hash_password(req.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password reset successful! You can now log in."}

@router.get("/me", response_model=UserOut)
def get_me(current_user: dict = Depends(get_current_user_data), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    u_code = get_user_code(user, db)
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        user_code=u_code,
        hospital_id=user.hospital_id,
        patient_id=user.patient_id,
        language_preference=user.language_preference or "en",
        created_at=user.created_at
    )

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user or not verify_password(req.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    valid, msg = validate_password_strength(req.new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully!"}
