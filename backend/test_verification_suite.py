import os
import sys
import datetime
import asyncio

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import (
    User, Patient, Provider, Connection, FollowupChart, Task, Document,
    EmailLog, Notification, AuditLog, SecondBrainNode
)
from app.security import hash_password
from app.api.documents import (
    remind_patient_document, upload_patient_document, get_patient_document_details,
    view_document_file, download_document_file, download_patient_zip
)
from app.api.patients import download_patient_pdf
from app.api.charts import publish_chart, confirm_chart_step

def run_tests():
    print("=" * 70)
    print("CAREBRIDGE AUTHENTICATED FILE PREVIEW & DOWNLOAD VERIFICATION SUITE")
    print("=" * 70)

    DB_FILE = "carebridge.db"
    engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    test_results = {}

    try:
        # Setup Hospital
        hos = db.query(Provider).filter(Provider.provider_id == "HOS-000001").first()
        if not hos:
            hos = Provider(
                provider_id="HOS-000001",
                name="General Medical Center",
                district="Chennai",
                public_email="gmhospital1980@gmail.com"
            )
            db.add(hos)
            db.commit()

        # Connected Hospital Staff User
        h_user = db.query(User).filter(User.email == "test_staff_v6@hospital.com").first()
        if not h_user:
            h_user = User(
                email="test_staff_v6@hospital.com",
                password_hash=hash_password("Pass123"),
                role="hospital_staff",
                name="Dr. Sarah Staff",
                hospital_id="HOS-000001"
            )
            db.add(h_user)
            db.commit()

        # Unconnected Hospital Staff User
        unconnected_h_user = db.query(User).filter(User.email == "unconnected_staff@hospital.com").first()
        if not unconnected_h_user:
            unconnected_h_user = User(
                email="unconnected_staff@hospital.com",
                password_hash=hash_password("Pass123"),
                role="hospital_staff",
                name="Dr. Stranger",
                hospital_id="HOS-999999"
            )
            db.add(unconnected_h_user)
            db.commit()

        # Connected Patient A
        p_a = db.query(Patient).filter(Patient.email == "patient_a_v6@test.com").first()
        if not p_a:
            p_a = Patient(
                patient_code="PAT-V60001",
                name="Patient Alpha",
                age=45,
                gender="Male",
                email="patient_a_v6@test.com",
                district="Chennai",
                hospital_id="HOS-000001"
            )
            db.add(p_a)
            db.commit()

        p_a_user = db.query(User).filter(User.email == "patient_a_v6@test.com").first()
        if not p_a_user:
            p_a_user = User(
                email="patient_a_v6@test.com",
                password_hash=hash_password("Pass123"),
                role="patient",
                name="Patient Alpha",
                patient_id=p_a.id
            )
            db.add(p_a_user)
            db.commit()

        # Connection Accepted for Patient A
        conn_a = db.query(Connection).filter(Connection.hospital_id == "HOS-000001", Connection.patient_id == p_a.id).first()
        if not conn_a:
            conn_a = Connection(hospital_id="HOS-000001", patient_id=p_a.id, status="accepted")
            db.add(conn_a)
        else:
            conn_a.status = "accepted"
        db.commit()

        # Unconnected Patient B
        p_b = db.query(Patient).filter(Patient.email == "patient_b_v6@test.com").first()
        if not p_b:
            p_b = Patient(
                patient_code="PAT-V60002",
                name="Patient Beta",
                age=32,
                gender="Female",
                email="patient_b_v6@test.com",
                district="Madurai"
            )
            db.add(p_b)
            db.commit()

        # Clean old test tasks & documents
        chart_a = db.query(FollowupChart).filter(FollowupChart.patient_id == p_a.id, FollowupChart.hospital_id == "HOS-000001").first()
        if not chart_a:
            chart_a = FollowupChart(
                patient_id=p_a.id,
                hospital_id="HOS-000001",
                status="Draft",
                discharge_date="2026-10-01",
                version=1,
                is_published=False
            )
            db.add(chart_a)
            db.commit()

        db.query(Task).filter(Task.chart_id == chart_a.id).delete()
        db.query(Document).filter(Document.patient_id.in_([p_a.id, p_b.id])).delete()
        db.commit()

        task1 = Task(
            chart_id=chart_a.id,
            patient_id=p_a.id,
            hospital_id="HOS-000001",
            title="Post-Op Ultrasound Scan",
            category="scan",
            instruction_text="Undergo abdominal scan and upload report.",
            simple_text="Undergo scan and upload report.",
            due_date="2026-10-15",
            order_index=0,
            needs_review=False,
            requires_document=True,
            status="Pending"
        )
        db.add(task1)
        db.commit()

        hospital_user_dict = {
            "user_id": h_user.id,
            "role": "hospital_staff",
            "name": "Dr. Sarah Staff",
            "hospital_id": "HOS-000001"
        }

        unconnected_user_dict = {
            "user_id": unconnected_h_user.id,
            "role": "hospital_staff",
            "name": "Dr. Stranger",
            "hospital_id": "HOS-999999"
        }

        patient_a_user_dict = {
            "user_id": p_a_user.id,
            "role": "patient",
            "name": "Patient Alpha",
            "patient_id": p_a.id,
            "email": p_a.email
        }

        # -----------------------------------------------------------------
        # TEST 1: Upload a PDF and a JPG as patient
        # -----------------------------------------------------------------
        print("\n--- Running Test 1: Patient Uploads PDF and JPG ---")
        try:
            class DummyFile:
                def __init__(self, filename, content, content_type):
                    self.filename = filename
                    self.content = content
                    self.content_type = content_type
                async def read(self):
                    return self.content

            pdf_bytes = b"%PDF-1.4 Mock Clinical Report PDF Data"
            jpg_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF Mock Scan JPG Data"

            dummy_pdf = DummyFile("clinical_report.pdf", pdf_bytes, "application/pdf")
            dummy_jpg = DummyFile("ultrasound_scan.jpg", jpg_bytes, "image/jpeg")

            doc_pdf = asyncio.run(upload_patient_document(
                file=dummy_pdf,
                document_type="Lab Report",
                task_id=task1.id,
                chart_id=chart_a.id,
                patient_id=p_a.id,
                current_user=patient_a_user_dict,
                db=db
            ))

            doc_jpg = asyncio.run(upload_patient_document(
                file=dummy_jpg,
                document_type="Scan Report",
                task_id=task1.id,
                chart_id=chart_a.id,
                patient_id=p_a.id,
                current_user=patient_a_user_dict,
                db=db
            ))

            assert doc_pdf.mime_type == "application/pdf"
            assert doc_jpg.mime_type == "image/jpeg"
            assert doc_pdf.file_size == len(pdf_bytes)
            assert doc_jpg.file_size == len(jpg_bytes)

            print(f"PASSED: Test 1 - Patient uploaded PDF ('{doc_pdf.file_name}') and JPG ('{doc_jpg.file_name}').")
            test_results["test_1"] = "PASS"
        except Exception as e:
            print(f"FAILED: Test 1 error: {e}")
            test_results["test_1"] = f"FAIL ({e})"

        # -----------------------------------------------------------------
        # TEST 2: Connected hospital View (inline) & Download (attachment)
        # -----------------------------------------------------------------
        print("\n--- Running Test 2: Connected Hospital View & Download ---")
        try:
            # Check View endpoint headers (inline)
            view_pdf_resp = view_document_file(document_id=doc_pdf.id, current_user=hospital_user_dict, db=db)
            assert view_pdf_resp.media_type == "application/pdf"
            assert "inline" in view_pdf_resp.headers.get("Content-Disposition", ""), f"View disposition header missing inline: {view_pdf_resp.headers}"

            view_jpg_resp = view_document_file(document_id=doc_jpg.id, current_user=hospital_user_dict, db=db)
            assert view_jpg_resp.media_type == "image/jpeg"
            assert "inline" in view_jpg_resp.headers.get("Content-Disposition", "")

            # Check Download endpoint headers (attachment)
            dl_pdf_resp = download_document_file(document_id=doc_pdf.id, current_user=hospital_user_dict, db=db)
            assert dl_pdf_resp.filename == "clinical_report.pdf"
            assert "attachment" in dl_pdf_resp.headers.get("Content-Disposition", "")

            dl_jpg_resp = download_document_file(document_id=doc_jpg.id, current_user=hospital_user_dict, db=db)
            assert dl_jpg_resp.filename == "ultrasound_scan.jpg"
            assert "attachment" in dl_jpg_resp.headers.get("Content-Disposition", "")

            # Check ZIP download endpoint
            zip_resp = download_patient_zip(patient_id=p_a.id, current_user=hospital_user_dict, db=db)
            assert zip_resp.media_type == "application/zip"
            assert "attachment" in zip_resp.headers.get("Content-Disposition", "")

            # Check PDF care plan download endpoint
            pdf_plan_resp = download_patient_pdf(patient_id=p_a.id, current_user=hospital_user_dict, db=db)
            assert pdf_plan_resp.media_type == "application/pdf"
            assert "attachment" in pdf_plan_resp.headers.get("Content-Disposition", "")

            print("PASSED: Test 2 - View returns inline disposition, Download returns attachment disposition with original filename.")
            test_results["test_2"] = "PASS"
        except Exception as e:
            print(f"FAILED: Test 2 error: {e}")
            test_results["test_2"] = f"FAIL ({e})"

        # -----------------------------------------------------------------
        # TEST 3: Unconnected hospital returns 403 Forbidden
        # -----------------------------------------------------------------
        print("\n--- Running Test 3: Unconnected Hospital 403 Forbidden Enforcement ---")
        try:
            # 1. Unconnected View Document PDF
            view_forbidden = False
            try:
                view_document_file(document_id=doc_pdf.id, current_user=unconnected_user_dict, db=db)
            except HTTPException as ex:
                if ex.status_code == 403: view_forbidden = True
            assert view_forbidden, "Unconnected view document did NOT return 403 Forbidden!"

            # 2. Unconnected Download Document JPG
            dl_forbidden = False
            try:
                download_document_file(document_id=doc_jpg.id, current_user=unconnected_user_dict, db=db)
            except HTTPException as ex:
                if ex.status_code == 403: dl_forbidden = True
            assert dl_forbidden, "Unconnected download document did NOT return 403 Forbidden!"

            # 3. Unconnected ZIP download
            zip_forbidden = False
            try:
                download_patient_zip(patient_id=p_a.id, current_user=unconnected_user_dict, db=db)
            except HTTPException as ex:
                if ex.status_code == 403: zip_forbidden = True
            assert zip_forbidden, "Unconnected ZIP download did NOT return 403 Forbidden!"

            # 4. Unconnected PDF care plan download
            pdf_forbidden = False
            try:
                download_patient_pdf(patient_id=p_a.id, current_user=unconnected_user_dict, db=db)
            except HTTPException as ex:
                if ex.status_code == 403: pdf_forbidden = True
            assert pdf_forbidden, "Unconnected PDF care plan download did NOT return 403 Forbidden!"

            print("PASSED: Test 3 - 403 Forbidden strictly returned for all view, download, ZIP, and PDF requests by unconnected hospital.")
            test_results["test_3"] = "PASS"
        except Exception as e:
            print(f"FAILED: Test 3 error: {e}")
            test_results["test_3"] = f"FAIL ({e})"

        # -----------------------------------------------------------------
        # TEST 4: DB & Disk File Persistence Across Restarts
        # -----------------------------------------------------------------
        print("\n--- Running Test 4: File Disk & DB Persistence Across Restarts ---")
        try:
            saved_p_id = p_a.id
            saved_doc_pdf_id = doc_pdf.id
            saved_doc_jpg_id = doc_jpg.id
            db.close()

            # Re-connect fresh DB session
            new_engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
            NewSession = sessionmaker(bind=new_engine)
            db2 = NewSession()

            reconnected_pdf = db2.query(Document).filter(Document.id == saved_doc_pdf_id).first()
            reconnected_jpg = db2.query(Document).filter(Document.id == saved_doc_jpg_id).first()

            assert reconnected_pdf is not None, "PDF record missing after restart."
            assert reconnected_jpg is not None, "JPG record missing after restart."

            # Verify files still exist on disk in uploads/
            upload_dir = "uploads"
            assert os.path.exists(upload_dir), "Uploads directory missing!"
            
            pdf_on_disk = any("clinical_report.pdf" in f for f in os.listdir(upload_dir))
            jpg_on_disk = any("ultrasound_scan.jpg" in f for f in os.listdir(upload_dir))

            assert pdf_on_disk, "Uploaded PDF file missing from uploads/ disk directory after restart!"
            assert jpg_on_disk, "Uploaded JPG file missing from uploads/ disk directory after restart!"

            print("PASSED: Test 4 - DB metadata and physical files in uploads/ folder persist intact across session restarts.")
            test_results["test_4"] = "PASS"
            db2.close()
        except Exception as e:
            print(f"FAILED: Test 4 error: {e}")
            test_results["test_4"] = f"FAIL ({e})"

    finally:
        db.close()

    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY REPORT:")
    print("=" * 70)
    for k, v in test_results.items():
        print(f"  [{v}] {k}")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
