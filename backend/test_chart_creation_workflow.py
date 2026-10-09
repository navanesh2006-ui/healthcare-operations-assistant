import os
import datetime
import requests

BASE_URL = "http://localhost:8000/api"

def run_tests():
    print("=" * 80)
    print("STARTING END-TO-END AUTOMATED VERIFICATION SUITE FOR CHART BUILDER FEATURE")
    print("=" * 80)

    # 1. Credentials
    hospital_email = "gmhospital1980@gmail.com"
    patient_email = "navanesh2006@gmail.com"
    hosp_password = "Password123!"
    patient_password = "Navi@2006"

    # Login Hospital Staff
    r_hosp = requests.post(f"{BASE_URL}/auth/hospital/login", json={"email": hospital_email, "password": hosp_password})
    if r_hosp.status_code != 200:
        print(f"FAILED Hospital Login: {r_hosp.status_code} - {r_hosp.text}")
        return
    hosp_token = r_hosp.json()["access_token"]
    hosp_headers = {"Authorization": f"Bearer {hosp_token}"}
    print(f"[OK] Hospital Staff Login OK: {hospital_email}")

    # Login Patient
    r_pat = requests.post(f"{BASE_URL}/auth/patient/login", json={"email": patient_email, "password": patient_password})
    if r_pat.status_code != 200:
        print(f"FAILED Patient Login: {r_pat.status_code} - {r_pat.text}")
        return
    pat_token = r_pat.json()["access_token"]
    patient_id = r_pat.json()["patient_id"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}
    print(f"[OK] Patient Login OK: {patient_email} (Patient ID: {patient_id})")

    results = {}

    # -------------------------------------------------------------------------
    # TEST SCENARIO 1: Manual Chart Creation with 5 Steps for Connected Patient
    # -------------------------------------------------------------------------
    print("\n--- Running Scenario 1: Create Chart Manually (5 steps) ---")
    today_str = datetime.date.today().isoformat()
    manual_steps = [
        {
            "title": "Cardiology Post-Discharge Check-up",
            "category": "appointment",
            "type": "Check-up / Appointment",
            "instruction_text": "Outpatient consultation with treating cardiologist.",
            "due_date": (datetime.date.today() + datetime.timedelta(days=7)).isoformat(),
            "relative_days": 7,
            "department": "Cardiology",
            "source": "manual",
            "needs_review": False
        },
        {
            "title": "Echocardiogram Diagnostic Scan",
            "category": "scan",
            "type": "Scan or Imaging",
            "instruction_text": "2D Echo ultrasound scan to evaluate ventricular ejection fraction.",
            "due_date": (datetime.date.today() + datetime.timedelta(days=14)).isoformat(),
            "relative_days": 14,
            "department": "Radiology",
            "source": "manual",
            "needs_review": False
        },
        {
            "title": "Complete Blood Count & Electrolytes Lab Test",
            "category": "test",
            "type": "Lab Test",
            "instruction_text": "Fasting lab draw for CBC, K+, Na+, and Creatinine.",
            "due_date": (datetime.date.today() + datetime.timedelta(days=6)).isoformat(),
            "relative_days": 6,
            "department": "Pathology",
            "source": "manual",
            "needs_review": False
        },
        {
            "title": "Daily Cardioprotective Medicine Dosage",
            "category": "medicine",
            "type": "Medicine instruction",
            "instruction_text": "Take Aspirin 75mg and Atorvastatin 20mg once daily after dinner.",
            "due_date": (datetime.date.today() + datetime.timedelta(days=1)).isoformat(),
            "relative_days": 1,
            "source": "manual",
            "needs_review": True
        },
        {
            "title": "Chest Pain Emergency Warning Signs",
            "category": "warning_sign",
            "type": "Warning signs",
            "instruction_text": "Report radiating chest pain, severe breathlessness, or dizziness immediately.",
            "due_date": (datetime.date.today() + datetime.timedelta(days=1)).isoformat(),
            "relative_days": 1,
            "source": "manual",
            "needs_review": False
        }
    ]

    r_create1 = requests.post(f"{BASE_URL}/charts/create", json={
        "patient_id": patient_id,
        "discharge_date": today_str,
        "steps": manual_steps,
        "source": "manual"
    }, headers=hosp_headers)

    if r_create1.status_code == 200 and len(r_create1.json().get("tasks", [])) == 5:
        chart1_id = r_create1.json()["id"]
        print(f"[PASS] Scenario 1 PASSED: Created manual chart #{chart1_id} with {len(r_create1.json()['tasks'])} steps.")
        results["Scenario 1"] = "PASS"
    else:
        print(f"[FAIL] Scenario 1 FAILED: {r_create1.status_code} - {r_create1.text}")
        results["Scenario 1"] = "FAIL"

    # -------------------------------------------------------------------------
    # TEST SCENARIO 2: Auto-generate Chart from 'Diabetes follow-up' Template, Edit 2 steps, Save Draft
    # -------------------------------------------------------------------------
    print("\n--- Running Scenario 2: Auto-generate from 'Diabetes follow-up' Template ---")
    r_gen = requests.post(f"{BASE_URL}/charts/auto-generate", json={
        "patient_id": patient_id,
        "problem_tags": ["Diabetes"],
        "discharge_date": today_str
    }, headers=hosp_headers)

    if r_gen.status_code == 200:
        gen_data = r_gen.json()
        gen_steps = gen_data["steps"]
        print(f"Fetched {len(gen_steps)} template steps for Diabetes.")

        # Edit 2 steps
        if len(gen_steps) >= 2:
            gen_steps[0]["instruction_text"] = (gen_steps[0].get("instruction_text") or gen_steps[0].get("instructions") or "") + " (Edited by staff: Measure fast at 7:00 AM)"
            gen_steps[1]["instruction_text"] = (gen_steps[1].get("instruction_text") or gen_steps[1].get("instructions") or "") + " (Edited by staff: Bring sugar logbook)"

        r_create2 = requests.post(f"{BASE_URL}/charts/create", json={
            "patient_id": patient_id,
            "discharge_date": today_str,
            "steps": gen_steps,
            "source": "template",
            "template_name": "Diabetes follow-up"
        }, headers=hosp_headers)

        if r_create2.status_code == 200 and r_create2.json()["status"] == "Draft":
            chart2_id = r_create2.json()["id"]
            print(f"[PASS] Scenario 2 PASSED: Auto-generated & saved draft chart #{chart2_id} with {len(gen_steps)} steps.")
            results["Scenario 2"] = "PASS"
        else:
            print(f"[FAIL] Scenario 2 FAILED: {r_create2.status_code} - {r_create2.text}")
            results["Scenario 2"] = "FAIL"
    else:
        print(f"[FAIL] Scenario 2 FAILED (auto-generate endpoint): {r_gen.status_code} - {r_gen.text}")
        results["Scenario 2"] = "FAIL"

    # -------------------------------------------------------------------------
    # TEST SCENARIO 3: Reviewer Approves and Hospital Publishes Chart
    # -------------------------------------------------------------------------
    print("\n--- Running Scenario 3: Reviewer Approval & Hospital Publish ---")
    r_app = requests.post(f"{BASE_URL}/charts/{chart1_id}/review-status", json={"status": "Approved"}, headers=hosp_headers)
    if r_app.status_code == 200 and r_app.json()["status"] == "Approved":
        print(f"Chart #{chart1_id} status updated to Approved.")

        r_pub = requests.post(f"{BASE_URL}/charts/{chart1_id}/publish", headers=hosp_headers)
        if r_pub.status_code == 200 and r_pub.json()["is_published"] is True:
            print(f"[PASS] Scenario 3 PASSED: Chart #{chart1_id} approved and published successfully.")
            results["Scenario 3"] = "PASS"
        else:
            print(f"[FAIL] Scenario 3 FAILED (Publish): {r_pub.status_code} - {r_pub.text}")
            results["Scenario 3"] = "FAIL"
    else:
        print(f"[FAIL] Scenario 3 FAILED (Approval): {r_app.status_code} - {r_app.text}")
        results["Scenario 3"] = "FAIL"

    # -------------------------------------------------------------------------
    # TEST SCENARIO 4: Patient receives Email & Notification and sees Graph
    # -------------------------------------------------------------------------
    print("\n--- Running Scenario 4: Patient Notification, Email Outbox & Graph View ---")
    r_pchart = requests.get(f"{BASE_URL}/patients/{patient_id}/chart", headers=pat_headers)
    r_outbox = requests.get(f"{BASE_URL}/outbox/", headers=hosp_headers)

    has_chart = (r_pchart.status_code == 200 and r_pchart.json() is not None and len(r_pchart.json().get("tasks", [])) > 0)
    has_email = (r_outbox.status_code == 200 and any("Published" in email["subject"] or "Chart" in email["subject"] for email in r_outbox.json()))

    if has_chart and has_email:
        print(f"[PASS] Scenario 4 PASSED: Patient retrieves active chart graph ({len(r_pchart.json()['tasks'])} tasks) and email was delivered to Outbox.")
        results["Scenario 4"] = "PASS"
    else:
        print(f"[FAIL] Scenario 4 FAILED: has_chart={has_chart}, has_email={has_email}")
        results["Scenario 4"] = "FAIL"

    # -------------------------------------------------------------------------
    # TEST SCENARIO 5: Hospital Edits a Published Step; Patient Sees Version Update Notification
    # -------------------------------------------------------------------------
    print("\n--- Running Scenario 5: Edit Published Chart & Patient Version Notification ---")
    updated_steps = manual_steps.copy()
    updated_steps[0]["instruction_text"] += " (Updated consult location: OPD Room 204)"

    r_edit = requests.put(f"{BASE_URL}/charts/{chart1_id}", json={
        "discharge_date": today_str,
        "steps": updated_steps
    }, headers=hosp_headers)

    if r_edit.status_code == 200:
        new_version = r_edit.json()["version"]
        print(f"Chart updated to version v{new_version}.")
        
        r_outbox2 = requests.get(f"{BASE_URL}/outbox/", headers=hosp_headers)
        has_update_email = any("Updated" in e["subject"] for e in r_outbox2.json())

        if new_version > 1 and has_update_email:
            print(f"[PASS] Scenario 5 PASSED: Published chart edited, version bumped to v{new_version}, update notification dispatched.")
            results["Scenario 5"] = "PASS"
        else:
            print(f"[FAIL] Scenario 5 FAILED: new_version={new_version}, has_update_email={has_update_email}")
            results["Scenario 5"] = "FAIL"
    else:
        print(f"[FAIL] Scenario 5 FAILED (PUT endpoint): {r_edit.status_code} - {r_edit.text}")
        results["Scenario 5"] = "FAIL"

    # -------------------------------------------------------------------------
    # TEST SCENARIO 6: Create Chart for Unconnected Patient Returns HTTP 403
    # -------------------------------------------------------------------------
    print("\n--- Running Scenario 6: Attempt Chart Creation for Unconnected Patient ---")
    unconnected_patient_id = 99999 # Non-existent or unconnected patient

    r_403 = requests.post(f"{BASE_URL}/charts/create", json={
        "patient_id": unconnected_patient_id,
        "discharge_date": today_str,
        "steps": manual_steps
    }, headers=hosp_headers)

    if r_403.status_code == 403:
        print(f"[PASS] Scenario 6 PASSED: Backend correctly returned HTTP 403 Forbidden ({r_403.json()['detail']}).")
        results["Scenario 6"] = "PASS"
    else:
        print(f"[FAIL] Scenario 6 FAILED: Expected 403 Forbidden, but received {r_403.status_code} - {r_403.text}")
        results["Scenario 6"] = "FAIL"

    # SUMMARY REPORT
    print("\n" + "=" * 80)
    print("FINAL CHART BUILDER FEATURE VERIFICATION REPORT")
    print("=" * 80)
    all_passed = True
    for test_name, status_val in results.items():
        symbol = "[PASS]" if status_val == "PASS" else "[FAIL]"
        print(f"{symbol} {test_name}: {status_val}")
        if status_val != "PASS": all_passed = False

    print("=" * 80)
    if all_passed:
        print("ALL 6 CHART BUILDER VERIFICATION SCENARIOS PASSED WITH 100% SUCCESS!")
    else:
        print("SOME SCENARIOS FAILED. CHECK LOGS ABOVE.")

if __name__ == "__main__":
    run_tests()
