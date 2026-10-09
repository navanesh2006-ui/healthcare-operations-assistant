import sys
import datetime
import random
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.models import (
    User, Provider, Patient, Connection, DischargeSummary, FollowupChart, Task,
    Doctor, AvailabilitySlot, BookingRequest, Feedback, AuditLog, Notification,
    Document, ChatHistory, OutboxEmail
)
from app.security import hash_password
from app.services.importer import import_providers
from app.services.second_brain import sync_second_brain_files_to_db

logger = logging.getLogger("seed")

def seed_providers_only(db: Session):
    """Seed ONLY the public hospital directory (providers) if empty, and sync Second Brain notes."""
    logger.info("Checking provider directory database table...")
    if db.query(Provider).count() == 0:
        logger.info("Providers table is empty. Importing Tamil Nadu hospital directory dataset...")
        import_providers(db)
    else:
        logger.info(f"Providers table already contains {db.query(Provider).count()} rows. Skipping import.")

    # Sync Second Brain files
    sync_second_brain_files_to_db(db)
    logger.info("Provider directory and Second Brain sync completed successfully.")

def cleanup_demo_data(db: Session):
    """Delete all fake demo users, patients, connections, charts, tasks, and sample bookings.

    Leaves the Provider dataset and Second Brain nodes intact!
    """
    logger.info("Starting cleanup of all demo/fake accounts and sample patient data...")

    db.query(BookingRequest).delete(synchronize_session=False)
    db.query(AvailabilitySlot).delete(synchronize_session=False)
    db.query(Doctor).delete(synchronize_session=False)
    db.query(Document).delete(synchronize_session=False)
    db.query(Feedback).delete(synchronize_session=False)
    db.query(Task).delete(synchronize_session=False)
    db.query(FollowupChart).delete(synchronize_session=False)
    db.query(DischargeSummary).delete(synchronize_session=False)
    db.query(Connection).delete(synchronize_session=False)
    db.query(Notification).delete(synchronize_session=False)
    db.query(OutboxEmail).delete(synchronize_session=False)
    db.query(ChatHistory).delete(synchronize_session=False)
    db.query(AuditLog).delete(synchronize_session=False)
    db.query(User).delete(synchronize_session=False)
    db.query(Patient).delete(synchronize_session=False)

    db.commit()
    logger.info("Demo account cleanup complete! Provider directory preserved.")

def seed_demo_accounts(db: Session):
    """Seed fake demo accounts (staff@hospital-a.demo, patient1@demo.com, etc.).

    ONLY called when explicitly passing --demo-accounts flag. Idempotent.
    """
    logger.info("Seeding optional demo accounts (--demo-accounts)...")
    seed_providers_only(db)

    h1 = db.query(Provider).filter(Provider.district == "Chennai").first()
    if not h1:
        h1 = Provider(
            provider_id="HOS-000001",
            name="Apollo City Center",
            facility_type="Hospital",
            ownership="Private",
            district="Chennai",
            address="Mint Street, Chennai",
            pincode="600001",
            latitude=13.08041,
            longitude=80.23873
        )
        db.add(h1)
        db.commit()

    h2 = db.query(Provider).filter(Provider.provider_id != h1.provider_id).first()
    if not h2:
        h2 = Provider(
            provider_id="HOS-000002",
            name="Kanchipuram General Hospital",
            facility_type="Hospital",
            ownership="Public-Government",
            district="Kanchipuram",
            address="Hospital Road, Kanchipuram",
            pincode="631501",
            latitude=12.8342,
            longitude=79.7036
        )
        db.add(h2)
        db.commit()

    h1_id = h1.provider_id
    h2_id = h2.provider_id

    # Hospital Staff & Reviewer accounts
    users_data = [
        {
            "email": "staff@hospital-a.demo",
            "name": "Dr. Rajesh Kumar (Staff Admin)",
            "role": "hospital_staff",
            "hospital_id": h1_id,
            "password": "Staff@123"
        },
        {
            "email": "reviewer@hospital-a.demo",
            "name": "Dr. Meena Swaminathan (Clinical Reviewer)",
            "role": "hospital_reviewer",
            "hospital_id": h1_id,
            "password": "Review@123"
        },
        {
            "email": "staff@hospital-b.demo",
            "name": "Nurse Anitha (Staff)",
            "role": "hospital_staff",
            "hospital_id": h2_id,
            "password": "Staff@123"
        }
    ]

    for u in users_data:
        existing = db.query(User).filter(User.email == u["email"].strip().lower()).first()
        if not existing:
            db_user = User(
                email=u["email"].strip().lower(),
                name=u["name"],
                role=u["role"],
                hospital_id=u["hospital_id"],
                password_hash=hash_password(u["password"])
            )
            db.add(db_user)
    db.commit()

    # Patient accounts
    patient_seed_specs = [
        {"email": "patient1@demo.com", "name": "Karthik Raman", "age": 62, "gender": "Male", "district": "Chennai", "pcode": "600001", "pass": "Patient@123"},
        {"email": "patient2@demo.com", "name": "Priya Sundar", "age": 34, "gender": "Female", "district": "Kanchipuram", "pcode": "631501", "pass": "Patient@123"},
        {"email": "patient3@demo.com", "name": "Sundar Subramanian", "age": 45, "gender": "Male", "district": "Coimbatore", "pcode": "641001", "pass": "Patient@123"},
    ]

    sample_patients = []
    for idx, ps in enumerate(patient_seed_specs):
        clean_email = ps["email"].strip().lower()
        existing_p = db.query(Patient).filter(Patient.email == clean_email).first()
        if not existing_p:
            p_code = f"PAT-{idx+101:06d}"
            patient = Patient(
                patient_code=p_code,
                name=ps["name"],
                age=ps["age"],
                gender=ps["gender"],
                email=clean_email,
                phone=f"+91 98400 {10000+idx}",
                district=ps["district"],
                pincode=ps["pcode"],
                hospital_id=h1_id if idx % 2 == 0 else h2_id,
                language_preference="en"
            )
            db.add(patient)
            db.flush()

            p_user = User(
                email=clean_email,
                name=ps["name"],
                role="patient",
                patient_id=patient.id,
                password_hash=hash_password(ps["pass"])
            )
            db.add(p_user)
            sample_patients.append(patient)
        else:
            sample_patients.append(existing_p)
    db.commit()

    # Connections
    if len(sample_patients) >= 3:
        p1, p2, p3 = sample_patients[0], sample_patients[1], sample_patients[2]
        conn_specs = [
            {"hospital_id": h1_id, "patient_id": p1.id, "status": "accepted", "msg": "PCI post-discharge follow-up."},
            {"hospital_id": h1_id, "patient_id": p2.id, "status": "pending", "msg": "Post-surgery care invitation."},
            {"hospital_id": h1_id, "patient_id": p3.id, "status": "declined", "msg": "Follow-up request."}
        ]
        for cs in conn_specs:
            existing_c = db.query(Connection).filter(
                Connection.hospital_id == cs["hospital_id"],
                Connection.patient_id == cs["patient_id"]
            ).first()
            if not existing_c:
                conn = Connection(
                    hospital_id=cs["hospital_id"],
                    patient_id=cs["patient_id"],
                    status=cs["status"],
                    message=cs["msg"],
                    responded_at=datetime.datetime.utcnow() if cs["status"] in ["accepted", "declined"] else None
                )
                db.add(conn)
        db.commit()

    logger.info("Demo accounts seeded successfully!")

def reset_database(db: Session, force: bool = False):
    """Wipe all tables completely and recreate schema.

    Prompts for confirmation unless force=True.
    """
    if not force:
        print("\n⚠️ WARNING: This will permanently delete ALL data in the CareBridge database!")
        confirm = input("Type YES to confirm database reset: ").strip()
        if confirm != "YES":
            print("Database reset cancelled.")
            return

    logger.info("Resetting database schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema recreated cleanly.")
    seed_providers_only(db)
    logger.info("Database reset complete. Hospital provider directory restored.")

# Backwards compatibility function
def seed_database(db: Session):
    seed_providers_only(db)
