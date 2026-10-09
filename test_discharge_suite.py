import os
import sys
import json
import sqlite3
import datetime
import asyncio
import httpx
from httpx import ASGITransport, AsyncClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("backend"))

from app.main import app
from app.database import SessionLocal, engine, Base
from app.models import User, Patient, Provider, Connection, FollowupChart, Task, AuditLog, DischargeSummary
from app.security import create_access_token

async def run_tests():
    print("==================================================")
    print("  RUNNING DISCHARGE 5-AGENT ANALYSIS TEST SUITE  ")
    print("==================================================")

    db = SessionLocal()
    try:
        # Create test provider and patient
        hospital_id = "HOS-TEST-001"
        provider = db.query(Provider).filter(Provider.provider_id == hospital_id).first()
        if not provider:
            provider = Provider(
                provider_id=hospital_id,
                name="CareBridge Test Hospital",
                facility_type="Hospital",
                ownership="Private",
                district="Chennai"
            )
            db.add(provider)

        # Create staff user
        staff_user = db.query(User).filter(User.email == "staff@test.com").first()
        if not staff_user:
            staff_user = User(
                email="staff@test.com",
                password_hash="hash",
                role="hospital_staff",
                name="Test Staff Member",
                hospital_id=hospital_id
            )
            db.add(staff_user)
            db.flush()

        # Create patient 1 (Karthik Raman)
        pat1 = db.query(Patient).filter((Patient.email == "karthik@test.com") | (Patient.patient_code == "PAT-000101")).first()
        if not pat1:
            pat1 = Patient(
                patient_code="PAT-000101",
                name="Karthik Raman",
                age=62,
                gender="Male",
                email="karthik@test.com",
                phone="9876543210",
                district="Chennai"
            )
            db.add(pat1)
            db.flush()

        # Create patient 2 (Meena Krishnan)
        pat2 = db.query(Patient).filter((Patient.email == "meena@test.com") | (Patient.patient_code == "PAT-000102")).first()
        if not pat2:
            pat2 = Patient(
                patient_code="PAT-000102",
                name="Meena Krishnan",
                age=58,
                gender="Female",
                email="meena@test.com",
                phone="9876543211",
                district="Chennai"
            )
            db.add(pat2)
            db.flush()

        # Ensure accepted connection for both patients with hospital_id
        for p in [pat1, pat2]:
            conn = db.query(Connection).filter(
                Connection.hospital_id == hospital_id,
                Connection.patient_id == p.id
            ).first()
            if not conn:
                conn = Connection(hospital_id=hospital_id, patient_id=p.id, status="accepted")
                db.add(conn)

        db.commit()

        # Generate Bearer Token for Staff User
        token_data = {
            "sub": staff_user.email,
            "role": staff_user.role,
            "name": staff_user.name,
            "email": staff_user.email,
            "user_id": staff_user.id,
            "user_code": hospital_id,
            "hospital_id": hospital_id
        }
        token = create_access_token(token_data)
        headers = {"Authorization": f"Bearer {token}"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            # -------------------------------------------------------------
            # TEST 1: Cardiac Post-PCI Preset Processing & 6-Section Report
            # -------------------------------------------------------------
            print("\n--- TEST 1: Cardiac Post-PCI Case ---")
            cardiac_text = """PATIENT DISCHARGE SUMMARY - CARDIOLOGY
Patient Name: Karthik Raman | Age: 62 | Gender: Male
Diagnosis: Acute Anterior Wall Myocardial Infarction s/p Primary PCI to LAD.

DISCHARGE MEDICATIONS:
1. Tab Aspirin 75mg once daily after breakfast.
2. Tab Clopidogrel 75mg once daily.
3. Tab Atorvastatin 40mg once daily at bedtime.
4. Tab Metoprolol 25mg twice daily - titrate as needed depending on pulse.

FOLLOW-UP PLAN & DIAGNOSTICS:
- Return to Cardiology OPD in 7 days for clinical review and wound inspection.
- Repeat Echocardiogram (ECHO) and 12-lead ECG in 5 days prior to OPD visit.
- Fasting lipid profile and serum creatinine lab test in 2 weeks.

HOME CARE & DIET:
- Strict salt restriction (<2g/day). Fluid intake restricted to 1.5L daily.
- Daily weight monitoring. Wound care for femoral access site - keep dry and clean.

EMERGENCY WARNING SIGNS:
- Immediate emergency return if patient experiences recurring chest pain, severe breathlessness, fever >101F, or sudden dizziness."""

            res1 = await client.post("/api/discharge/process", json={"patient_id": pat1.id, "raw_text": cardiac_text}, headers=headers)
            assert res1.status_code == 200, f"Test 1 Failed: {res1.text}"
            chart1 = res1.json()
            assert chart1["analysis_report"] is not None, "Test 1 Failed: Missing analysis report"
            rep1 = chart1["analysis_report"]
            assert rep1["section_a"]["patient_name"] == "Karthik Raman"
            assert "Myocardial Infarction" in rep1["section_b"]["diagnosis_verbatim"]
            assert rep1["section_b"]["explanation_en"] is not None
            assert len(rep1["section_d"]["medicines"]) >= 4
            
            # Check titration flagging
            metro = next((m for m in rep1["section_d"]["medicines"] if "Metoprolol" in m["instruction_text"]), None)
            assert metro is not None and metro["status"] == "Needs Review", "Test 1 Failed: Metoprolol titration not flagged Needs Review"
            print("PASS: Cardiac Post-PCI preset extracted 6 sections with evidence & Needs Review titration flag.")

            # PDF Download check
            pdf_res = await client.get(f"/api/discharge/report-pdf/{chart1['id']}", headers=headers)
            assert pdf_res.status_code == 200, f"Test 1 PDF Download Failed: {pdf_res.text}"
            assert pdf_res.headers["content-type"] == "application/pdf"
            assert len(pdf_res.content) > 1000
            print("PASS: 6-Section Analysis Report PDF generated and downloaded cleanly.")

            # -------------------------------------------------------------
            # TEST 2: Laparoscopic Surgery (Ambiguous Preset)
            # -------------------------------------------------------------
            print("\n--- TEST 2: Laparoscopic Surgery (Ambiguous Preset) ---")
            lap_text = """PATIENT DISCHARGE SUMMARY - SURGICAL WARD
Procedure: Laparoscopic Cholecystectomy.
Instructions:
- Wound dressing change after 3 days.
- Tab Amoxicillin-Clavulanate 625mg twice daily for 5 days.
- Follow-up with General Surgery team in 10-14 days or as needed."""

            res2 = await client.post("/api/discharge/process", json={"patient_id": pat1.id, "raw_text": lap_text}, headers=headers)
            assert res2.status_code == 200, f"Test 2 Failed: {res2.text}"
            chart2 = res2.json()
            rep2 = chart2["analysis_report"]
            assert "Cholecystectomy" in rep2["section_b"]["diagnosis_verbatim"]
            assert "gallbladder" in rep2["section_b"]["explanation_en"].lower()
            
            # Verify ambiguous return timeframe is flagged
            amb_task = next((t for t in chart2["tasks"] if t["needs_review"]), None)
            assert amb_task is not None, "Test 2 Failed: Ambiguous return timeframe was not flagged Needs Review!"
            print("PASS: Ambiguous surgical follow-up timeframe flagged Needs Review instead of guessed.")

            # -------------------------------------------------------------
            # TEST 3: Diabetes Management Case Preset
            # -------------------------------------------------------------
            print("\n--- TEST 3: Diabetes Management Case Preset ---")
            diab_text = """PATIENT DISCHARGE SUMMARY - ENDOCRINOLOGY
Diagnosis: Type 2 Diabetes Mellitus.
Instructions:
- Inj Insulin Glargine 14 units SubQ at bedtime.
- Repeat HbA1c test in 10 days.
- Follow-up appointment in Diabetology OPD in 2 weeks."""

            res3 = await client.post("/api/discharge/process", json={"patient_id": pat1.id, "raw_text": diab_text}, headers=headers)
            assert res3.status_code == 200, f"Test 3 Failed: {res3.text}"
            chart3 = res3.json()
            rep3 = chart3["analysis_report"]
            assert "Diabetes" in rep3["section_b"]["diagnosis_verbatim"]
            print("PASS: Diabetes management case extracted correctly.")

            # -------------------------------------------------------------
            # TEST 4: Patient Mismatch Check
            # -------------------------------------------------------------
            print("\n--- TEST 4: Patient Mismatch Check ---")
            # Summary text is for "Karthik Raman", but we submit for Patient 2 "Meena Krishnan"
            res4_err = await client.post("/api/discharge/process", json={"patient_id": pat2.id, "raw_text": cardiac_text, "confirm_mismatch": False}, headers=headers)
            assert res4_err.status_code == 400, "Test 4 Failed: Expected 400 Bad Request on patient mismatch"
            assert "summary appears to be for" in res4_err.json()["detail"].lower()
            print("PASS: Backend correctly blocked unconfirmed patient mismatch with 400 error.")

            # Now submit with confirm_mismatch = True
            res4_ok = await client.post("/api/discharge/process", json={"patient_id": pat2.id, "raw_text": cardiac_text, "confirm_mismatch": True}, headers=headers)
            assert res4_ok.status_code == 200, f"Test 4 Confirmation Failed: {res4_ok.text}"
            print("PASS: Staff confirmation logged and summary processed successfully.")

            # Check Audit Log for mismatch confirmation
            audit = db.query(AuditLog).filter(AuditLog.action == "CONFIRM_SUMMARY_PATIENT_MISMATCH").first()
            assert audit is not None, "Test 4 Failed: AuditLog entry for mismatch confirmation not found!"
            print("PASS: CONFIRM_SUMMARY_PATIENT_MISMATCH audit log recorded.")

            # -------------------------------------------------------------
            # TEST 5: Publishing Guard & Step Confirmation
            # -------------------------------------------------------------
            print("\n--- TEST 5: Publishing Guard & Step Confirmation ---")
            # Try publishing chart1 which has flagged Metoprolol task
            pub_err = await client.post(f"/api/charts/{chart1['id']}/publish", headers=headers)
            assert pub_err.status_code == 400, "Test 5 Failed: Expected publishing to be blocked when steps need review"
            assert "Cannot publish chart" in pub_err.json()["detail"]
            print("PASS: Publishing blocked when 1 or more steps require human review.")

            # Confirm all flagged tasks in chart1
            for t in chart1["tasks"]:
                if t["needs_review"] or t["status"] == "Needs Review":
                    conf_res = await client.post(f"/api/charts/steps/{t['id']}/confirm", json={"reviewer_notes": "Confirmed by clinician"}, headers=headers)
                    assert conf_res.status_code == 200, f"Step confirm failed for task {t['id']}"

            # Try publishing again
            pub_ok = await client.post(f"/api/charts/{chart1['id']}/publish", headers=headers)
            assert pub_ok.status_code == 200, f"Test 5 Publish Failed: {pub_ok.text}"
            assert pub_ok.json()["is_published"] is True
            print("PASS: Chart successfully published after all flagged steps confirmed.")

            print("\n==================================================")
            print("    ALL DISCHARGE SUITE TESTS PASSED (100%)      ")
            print("==================================================")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
