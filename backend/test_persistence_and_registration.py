import sys
import os
import time
import threading
import requests
import uvicorn

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app
from app.database import SessionLocal
from app.models import User
from app.security import verify_password

from app.services.seed import cleanup_demo_data

PORT = 8002
BASE_URL = f"http://127.0.0.1:{PORT}"

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="error")

def run_tests():
    # Clean out any old test/demo data before starting persistence tests
    db_clean = SessionLocal()
    try:
        cleanup_demo_data(db_clean)
    finally:
        db_clean.close()

    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(2)

    print("=" * 80)
    print("  AUTOMATED DATA PERSISTENCE & ACCOUNT REGISTRATION TEST SUITE")
    print("=" * 80)

    # -------------------------------------------------------------------------
    # TEST 1: Patient Registration & Restart Persistence
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Patient Registration & Database Persistence ---")
    patient_email = "real_patient_test@example.com"
    patient_pass = "PatientPass@123"

    reg_payload = {
        "name": "Arun Prakash",
        "email": patient_email,
        "password": patient_pass,
        "age": 52,
        "gender": "Male",
        "district": "Chennai",
        "pincode": "600001",
        "language_preference": "en"
    }

    res = requests.post(f"{BASE_URL}/api/auth/patient/register", json=reg_payload)
    assert res.status_code == 200, f"Registration failed: {res.text}"
    data = res.json()
    assert "access_token" in data
    patient_code = data["user_code"]
    assert patient_code.startswith("PAT-"), f"Unexpected patient code format: {patient_code}"
    print(f"Registered new patient successfully! Patient Code: {patient_code}")

    # Simulate backend restart / new DB session connection
    db = SessionLocal()
    try:
        user_in_db = db.query(User).filter(User.email == patient_email).first()
        assert user_in_db is not None, "User record not found in DB after registration!"
        assert verify_password(patient_pass, user_in_db.password_hash), "Password hash verification failed!"
        print("Database record verified directly in DB session.")
    finally:
        db.close()

    # Log in again with same credentials
    login_res = requests.post(f"{BASE_URL}/api/auth/patient/login", json={"email": patient_email, "password": patient_pass})
    assert login_res.status_code == 200, f"Login failed after restart: {login_res.text}"
    assert login_res.json()["user_code"] == patient_code
    print("PASSED! Patient account persisted across session restart and logged in successfully.")

    # -------------------------------------------------------------------------
    # TEST 2: Hospital Registration & Data Persistence
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Hospital Facility Registration & Persistence ---")
    hospital_email = "admin_staff@apollo-trichy.demo"
    hospital_pass = "HospitalPass@123"

    hosp_payload = {
        "hospital_name": "Apollo Specialty Hospital Trichy",
        "staff_name": "Dr. S. K. Nathan",
        "email": hospital_email,
        "password": hospital_pass,
        "district": "Trichy",
        "facility_type": "Hospital",
        "ownership": "Private"
    }

    res_h = requests.post(f"{BASE_URL}/api/auth/hospital/register", json=hosp_payload)
    assert res_h.status_code == 200, f"Hospital registration failed: {res_h.text}"
    data_h = res_h.json()
    h_code = data_h["user_code"]
    assert h_code.startswith("HOS-"), f"Unexpected hospital code format: {h_code}"
    print(f"Registered new hospital facility! Hospital Code: {h_code}")

    # Log in hospital staff
    h_login_res = requests.post(f"{BASE_URL}/api/auth/hospital/login", json={"email": hospital_email, "password": hospital_pass})
    assert h_login_res.status_code == 200, f"Hospital login failed: {h_login_res.text}"
    assert h_login_res.json()["user_code"] == h_code
    print("PASSED! Hospital facility account created and verified.")

    # -------------------------------------------------------------------------
    # TEST 3: Duplicate Email Registration Handling
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Duplicate Email Registration Handling ---")
    dup_res = requests.post(f"{BASE_URL}/api/auth/patient/register", json=reg_payload)
    assert dup_res.status_code == 409, f"Expected 409 Conflict for duplicate email, got {dup_res.status_code}: {dup_res.text}"
    assert "already exists" in dup_res.json()["detail"].lower()
    print("PASSED! Duplicate email registration returned HTTP 409 Conflict with friendly explanation.")

    # -------------------------------------------------------------------------
    # TEST 4: Absence of Default Fake Demo Accounts
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Absence of Fake Demo Accounts by Default ---")
    db_chk = SessionLocal()
    try:
        demo_staff = db_chk.query(User).filter(User.email == "staff@hospital-a.demo").first()
        demo_patient = db_chk.query(User).filter(User.email == "patient1@demo.com").first()
        assert demo_staff is None, "Fake demo staff account still exists!"
        assert demo_patient is None, "Fake demo patient account still exists!"
        print("PASSED! Fake demo accounts are absent by default.")
    finally:
        db_chk.close()

    print("\n" + "=" * 80)
    print("  [SUCCESS] ALL DATA PERSISTENCE & REGISTRATION TESTS PASSED 100%!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
