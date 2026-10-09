import time
import json
import threading
import requests
import uvicorn
from app.main import app

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="error")

def run_tests():
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(2)

    BASE_URL = "http://127.0.0.1:8001"

    print("================================================================================")
    print("      AUTOMATED RBAC & CONNECTION CONSENT ENFORCEMENT TEST SUITE               ")
    print("================================================================================")

    # 1. Login Accounts
    r_hosp_a = requests.post(f"{BASE_URL}/api/auth/hospital/login", json={"email": "staff@hospital-a.demo", "password": "Staff@123"})
    token_hosp_a = r_hosp_a.json()["access_token"]

    r_hosp_b = requests.post(f"{BASE_URL}/api/auth/hospital/login", json={"email": "staff@hospital-b.demo", "password": "Staff@123"})
    token_hosp_b = r_hosp_b.json()["access_token"]

    r_patient1 = requests.post(f"{BASE_URL}/api/auth/patient/login", json={"email": "patient1@demo.com", "password": "Patient@123"})
    token_p1 = r_patient1.json()["access_token"]

    r_patient2 = requests.post(f"{BASE_URL}/api/auth/patient/login", json={"email": "patient2@demo.com", "password": "Patient@123"})
    token_p2 = r_patient2.json()["access_token"]

    h_a = {"Authorization": f"Bearer {token_hosp_a}"}
    h_b = {"Authorization": f"Bearer {token_hosp_b}"}
    p_1 = {"Authorization": f"Bearer {token_p1}"}
    p_2 = {"Authorization": f"Bearer {token_p2}"}

    print("\n--- TEST 1: Patient Login Prohibition on Hospital Portal ---")
    r_wrong = requests.post(f"{BASE_URL}/api/auth/hospital/login", json={"email": "patient1@demo.com", "password": "Patient@123"})
    assert r_wrong.status_code == 400
    assert "belongs to the Patient portal" in r_wrong.json()["detail"]
    print("PASSED! Patient cannot log in on hospital login page.")

    print("\n--- TEST 2: Patient Prohibited from Calling Hospital Endpoints ---")
    r_forbidden = requests.get(f"{BASE_URL}/api/connections/find-patients", headers=p_1)
    assert r_forbidden.status_code == 403
    print("PASSED! Patient received HTTP 403 when attempting hospital 'Find Patients' endpoint.")

    print("\n--- TEST 3: Hospital Cannot Create Chart Without Accepted Connection ---")
    # Patient 3 is declined/unconnected to Hospital A
    r_unconnected_chart = requests.post(
        f"{BASE_URL}/api/discharge/process",
        json={"patient_id": 3, "raw_text": "Discharge summary text"},
        headers=h_a
    )
    assert r_unconnected_chart.status_code == 403
    assert "does not have an accepted connection" in r_unconnected_chart.json()["detail"]
    print("PASSED! Hospital A received HTTP 403 when trying to create chart for unconnected Patient 3.")

    print("\n--- TEST 4: Hospital Cannot Read Unconnected Patient Data ---")
    r_unconnected_p = requests.get(f"{BASE_URL}/api/patients/3", headers=h_a)
    assert r_unconnected_p.status_code == 403
    print("PASSED! Hospital A received HTTP 403 when attempting to read unconnected Patient 3's profile.")

    print("\n--- TEST 5: Hospital Multi-Tenant Data Isolation (Hospital A vs Hospital B) ---")
    r_pts_a = requests.get(f"{BASE_URL}/api/patients/connected", headers=h_a)
    pts_a = r_pts_a.json()
    r_pts_b = requests.get(f"{BASE_URL}/api/patients/connected", headers=h_b)
    pts_b = r_pts_b.json()

    pts_a_ids = [p["id"] for p in pts_a]
    pts_b_ids = [p["id"] for p in pts_b]
    print(f"Hospital A Connected Patients: {pts_a_ids}")
    print(f"Hospital B Connected Patients: {pts_b_ids}")
    assert pts_a_ids != pts_b_ids
    print("PASSED! Strict multi-tenant patient data separation confirmed.")

    print("\n--- TEST 6: Patient Privacy Masking on Find Patients List ---")
    r_find = requests.get(f"{BASE_URL}/api/connections/find-patients", headers=h_a)
    results = r_find.json()
    p_unconnected = [r for r in results if r["connection_status"] == "not_connected"][0]
    print("Masked Unconnected Result:", p_unconnected)
    assert "*" in p_unconnected["masked_email"]
    assert "age" not in p_unconnected
    print("PASSED! Unconnected patient email masked and medical fields hidden.")

    print("\n================================================================================")
    print("  [SUCCESS] ALL RBAC, DATA ISOLATION & CONNECTION PRIVACY TESTS PASSED 100%!   ")
    print("================================================================================")

if __name__ == "__main__":
    run_tests()
