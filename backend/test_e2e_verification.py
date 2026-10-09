import sys
import os
import time
import threading
import requests
import uvicorn

sys.path.insert(0, os.path.dirname(__file__))

from app.main import app
from app.database import SessionLocal
from app.models import User, OutboxEmail, Notification
from app.services.seed import reset_database
from app.security import verify_password

PORT = 8004
BASE_URL = f"http://127.0.0.1:{PORT}"

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="error")

def run_e2e_tests():
    db = SessionLocal()
    try:
        reset_database(db, force=True)
    finally:
        db.close()

    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(2)

    print("=" * 85)
    print("        CAREBRIDGE FULL END-TO-END WORKFLOW & REAL EMAIL VERIFICATION")
    print("=" * 85)

    report = []

    # -------------------------------------------------------------------------
    # STEP 1: Register Hospital & Patient with Real Email Addresses
    # -------------------------------------------------------------------------
    print("\n--- STEP 1: Registration with Real Email Normalization & Immediate Active State ---")
    h_email = "hospital_admin_e2e@example.com"
    p_email = "patient_user_e2e@example.com"
    h_pass = "HospitalPass@123"
    p_pass = "PatientPass@123"

    h_reg = requests.post(f"{BASE_URL}/api/auth/hospital/register", json={
        "hospital_name": "Apollo City Center",
        "staff_name": "Dr. Subramanian",
        "email": f"  {h_email.upper()}  ",  # Test email normalization
        "password": h_pass,
        "district": "Chennai",
        "facility_type": "Hospital",
        "ownership": "Private"
    })
    
    step1_h_ok = h_reg.status_code == 200
    h_code = h_reg.json().get("user_code", "") if step1_h_ok else ""
    print(f"Hospital Sign-up Result: {'PASS' if step1_h_ok else 'FAIL'} (Code: {h_code})")

    p_reg = requests.post(f"{BASE_URL}/api/auth/patient/register", json={
        "name": "Karthik Raman",
        "email": f"  {p_email.upper()}  ",  # Test email normalization
        "password": p_pass,
        "age": 45,
        "gender": "Male",
        "district": "Chennai",
        "pincode": "600001",
        "language_preference": "en"
    })
    
    step1_p_ok = p_reg.status_code == 200
    p_data = p_reg.json() if step1_p_ok else {}
    p_code = p_data.get("user_code", "")
    p_id = p_data.get("patient_id", None)
    print(f"Patient Sign-up Result: {'PASS' if step1_p_ok else 'FAIL'} (Code: {p_code}, Patient ID: {p_id})")

    report.append(("1. Register Hospital and Patient Accounts", step1_h_ok and step1_p_ok))

    # -------------------------------------------------------------------------
    # STEP 2: Immediate Login & Distinct Error Verification
    # -------------------------------------------------------------------------
    print("\n--- STEP 2: Immediate Login & Distinct Error Handling ---")
    
    # Login immediately after registration
    h_login = requests.post(f"{BASE_URL}/api/auth/hospital/login", json={"email": h_email, "password": h_pass})
    p_login = requests.post(f"{BASE_URL}/api/auth/patient/login", json={"email": p_email, "password": p_pass})

    step2_login_ok = h_login.status_code == 200 and p_login.status_code == 200
    h_token = h_login.json().get("access_token", "") if h_login.status_code == 200 else ""
    p_token = p_login.json().get("access_token", "") if p_login.status_code == 200 else ""
    print(f"Immediate Logins: {'PASS' if step2_login_ok else 'FAIL'}")

    # Verify distinct errors: 404 missing user, 403 wrong portal, 401 wrong pass
    err_404 = requests.post(f"{BASE_URL}/api/auth/patient/login", json={"email": "nonexistent@demo.com", "password": "pass"})
    err_403 = requests.post(f"{BASE_URL}/api/auth/hospital/login", json={"email": p_email, "password": p_pass})
    err_401 = requests.post(f"{BASE_URL}/api/auth/patient/login", json={"email": p_email, "password": "WrongPassword@123"})

    step2_errors_ok = (err_404.status_code == 404) and (err_403.status_code == 403) and (err_401.status_code == 401)
    print(f"Distinct Error Status Codes (404/403/401): {'PASS' if step2_errors_ok else 'FAIL'}")
    report.append(("2. Immediate Active Login & Distinct Errors", step2_login_ok and step2_errors_ok))

    # -------------------------------------------------------------------------
    # STEP 3: Check Welcome Email Transmission Logs
    # -------------------------------------------------------------------------
    print("\n--- STEP 3: Outbox Welcome Email Logs ---")
    db_chk = SessionLocal()
    try:
        outbox_count = db_chk.query(OutboxEmail).count()
        emails = db_chk.query(OutboxEmail).all()
        subjects = [e.subject for e in emails]
        step3_ok = outbox_count >= 2
        print(f"Outbox Email Count: {outbox_count} (Subjects: {subjects})")
    finally:
        db_chk.close()
    
    report.append(("3. Welcome Email Transmission", step3_ok))

    # -------------------------------------------------------------------------
    # STEP 4: Hospital Find Patients Search & Send Follow Request
    # -------------------------------------------------------------------------
    print("\n--- STEP 4: Hospital Search Patient Directory & Send Request ---")
    h_headers = {"Authorization": f"Bearer {h_token}"}
    
    search_res = requests.get(f"{BASE_URL}/api/connections/find-patients?q=Karthik", headers=h_headers)
    step4_search_ok = search_res.status_code == 200 and len(search_res.json()) > 0
    
    if step4_search_ok:
        patient_record = search_res.json()[0]
        assert patient_record["patient_code"] == p_code
        print(f"Found Patient: {patient_record['name']} ({patient_record['patient_code']})")

        req_res = requests.post(
            f"{BASE_URL}/api/connections/request",
            json={"patient_id": patient_record["id"], "message": "Post-discharge follow-up care invitation."},
            headers=h_headers
        )
        step4_req_ok = req_res.status_code == 200
        conn_id = req_res.json().get("id") if step4_req_ok else None
        print(f"Sent Connection Request: {'PASS' if step4_req_ok else 'FAIL'} (Connection ID: {conn_id})")
    else:
        step4_req_ok = False

    report.append(("4. Hospital Search & Send Follow Request", step4_search_ok and step4_req_ok))

    # -------------------------------------------------------------------------
    # STEP 5: Patient Receives Email/Notification & Accepts Connection
    # -------------------------------------------------------------------------
    print("\n--- STEP 5: Patient Consent Acceptance ---")
    p_headers = {"Authorization": f"Bearer {p_token}"}

    accept_res = requests.post(
        f"{BASE_URL}/api/connections/{conn_id}/action",
        json={"action": "accept"},
        headers=p_headers
    )
    step5_ok = accept_res.status_code == 200 and accept_res.json()["status"] == "accepted"
    print(f"Patient Accepted Connection: {'PASS' if step5_ok else 'FAIL'}")

    report.append(("5. Patient Accept Connection Request", step5_ok))

    # -------------------------------------------------------------------------
    # STEP 6: Hospital Discharge Chart Creation & Publishing
    # -------------------------------------------------------------------------
    print("\n--- STEP 6: Hospital Create & Publish Discharge Chart ---")
    ds_payload = {
        "patient_id": p_id,
        "raw_text": "PATIENT DISCHARGE SUMMARY\nDiagnosis: Post-PCI Recovery.\nMedication: Aspirin 75mg daily.\nFollow-up: Cardiology OPD in 7 days."
    }

    proc_res = requests.post(f"{BASE_URL}/api/discharge/process", json=ds_payload, headers=h_headers)
    step6_proc_ok = proc_res.status_code == 200
    chart_id = proc_res.json().get("id") if step6_proc_ok else None

    if step6_proc_ok:
        pub_res = requests.post(f"{BASE_URL}/api/tasks/charts/{chart_id}/publish", headers=h_headers)
        step6_pub_ok = pub_res.status_code == 200 and pub_res.json()["is_published"] == True
        print(f"Chart Processed & Published: {'PASS' if step6_pub_ok else 'FAIL'}")
    else:
        step6_pub_ok = False

    report.append(("6. Hospital Discharge Chart Publishing", step6_proc_ok and step6_pub_ok))

    # -------------------------------------------------------------------------
    # STEP 7: Test SMTP Endpoint Verification
    # -------------------------------------------------------------------------
    print("\n--- STEP 7: SMTP Test Endpoint Verification ---")
    test_email_res = requests.post(f"{BASE_URL}/api/outbox/test-email", json={"recipient_email": "admin_verifier@example.com"})
    step7_ok = test_email_res.status_code == 200
    print(f"Test Email Endpoint: {'PASS' if step7_ok else 'FAIL'} (Status: {test_email_res.json().get('status')})")
    report.append(("7. Real SMTP Test Endpoint", step7_ok))

    # -------------------------------------------------------------------------
    # FINAL SUMMARY REPORT
    # -------------------------------------------------------------------------
    print("\n" + "=" * 85)
    print("                             FINAL VERIFICATION REPORT")
    print("=" * 85)
    all_passed = True
    for step_title, passed in report:
        status_label = "[PASS]" if passed else "[FAIL]"
        if not passed: all_passed = False
        print(f" {status_label} {step_title}")
    print("=" * 85)
    assert all_passed, "One or more E2E verification steps failed!"

if __name__ == "__main__":
    run_e2e_tests()
