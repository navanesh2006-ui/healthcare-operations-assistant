import sys
import os
import time
import threading
import requests
import uvicorn

sys.path.insert(0, os.path.dirname(__file__))

from app.main import app
from app.database import SessionLocal
from app.services.seed import cleanup_demo_data

PORT = 8003
BASE_URL = f"http://127.0.0.1:{PORT}"

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="error")

def run_tests():
    # Clean DB
    db = SessionLocal()
    try:
        cleanup_demo_data(db)
    finally:
        db.close()

    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(2)

    print("=" * 80)
    print("  TESTING PATIENT REGISTRATION & HOSPITAL FIND PATIENTS SEARCH")
    print("=" * 80)

    # 1. Register Patient Navanesh K
    p_payload = {
        "name": "Navanesh K",
        "email": "navanesh2006@gmail.com",
        "password": "Password@123",
        "age": 20,
        "gender": "Male",
        "district": "Chennai",
        "pincode": "600001",
        "language_preference": "en"
    }

    p_res = requests.post(f"{BASE_URL}/api/auth/patient/register", json=p_payload)
    assert p_res.status_code == 200, f"Patient registration failed: {p_res.text}"
    p_data = p_res.json()
    p_token = p_data["access_token"]
    p_code = p_data["user_code"]
    p_id = p_data["patient_id"]
    print(f"1. Registered Patient Navanesh K successfully! Code: {p_code}, ID: {p_id}")

    # 2. Register Hospital Staff Joe
    h_payload = {
        "hospital_name": "Apollo City Center",
        "staff_name": "joe",
        "email": "joe@hospital.demo",
        "password": "Password@123",
        "district": "Chennai",
        "facility_type": "Hospital",
        "ownership": "Private"
    }

    h_res = requests.post(f"{BASE_URL}/api/auth/hospital/register", json=h_payload)
    assert h_res.status_code == 200, f"Hospital registration failed: {h_res.text}"
    h_data = h_res.json()
    h_token = h_data["access_token"]
    h_code = h_data["user_code"]
    print(f"2. Registered Hospital Staff joe successfully! Hospital Code: {h_code}")

    # 3. Hospital Search for Navanesh K
    headers_h = {"Authorization": f"Bearer {h_token}"}
    search_res = requests.get(f"{BASE_URL}/api/connections/find-patients?q=Navanesh", headers=headers_h)
    assert search_res.status_code == 200, f"Find patients search failed: {search_res.text}"
    results = search_res.json()
    assert len(results) > 0, "No patients found matching 'Navanesh'!"
    found = results[0]
    assert found["name"] == "Navanesh K"
    assert found["patient_code"] == p_code
    print(f"3. Hospital found Patient in search: {found['name']} ({found['patient_code']}), Masked Email: {found['masked_email']}")

    # 4. Hospital Send Follow Request to Navanesh K
    req_res = requests.post(
        f"{BASE_URL}/api/connections/request",
        json={"patient_id": found["id"], "message": "Requesting follow-up connection."},
        headers=headers_h
    )
    assert req_res.status_code == 200, f"Send request failed: {req_res.text}"
    conn_data = req_res.json()
    conn_id = conn_data["id"]
    print(f"4. Follow request sent! Connection ID: {conn_id}, Status: {conn_data['status']}")

    # 5. Patient Navanesh K Accept Request
    headers_p = {"Authorization": f"Bearer {p_token}"}
    act_res = requests.post(
        f"{BASE_URL}/api/connections/{conn_id}/action",
        json={"action": "accept"},
        headers=headers_p
    )
    assert act_res.status_code == 200, f"Patient accept action failed: {act_res.text}"
    assert act_res.json()["status"] == "accepted"
    print(f"5. Patient accepted connection! New Status: {act_res.json()['status']}")

    print("\n" + "=" * 80)
    print("  [SUCCESS] PATIENT SEARCH & CONNECTION WORKFLOW PASSED 100%!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
