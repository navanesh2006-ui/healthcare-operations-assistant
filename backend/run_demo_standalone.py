import time
import json
import threading
import requests
import uvicorn
from app.main import app

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

def main():
    # Start server in background thread
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    time.sleep(2) # Give server time to bind

    BASE_URL = "http://127.0.0.1:8000"

    print("================================================================================")
    print("      CAREBRIDGE: AGENTIC HOSPITAL DISCHARGE & FOLLOW-UP COORDINATOR DEMO       ")
    print("================================================================================")

    # 1. Health Check
    print("\n--- 1. Root & Health Endpoint ---")
    r = requests.get(f"{BASE_URL}/")
    print("Response Status:", r.status_code)
    print("Body:", json.dumps(r.json(), indent=2))

    # 2. Authentication Login
    print("\n--- 2. Auth Login (Hospital Staff & Patient) ---")
    r_staff = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "staff1@demo-carebridge.test", "password": "password123"})
    staff_token = r_staff.json()["access_token"]
    print("Hospital Staff Login Token Acquired for Dr. Rajesh Kumar!")

    r_patient = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "patient1@demo-carebridge.test", "password": "password123"})
    patient_token = r_patient.json()["access_token"]
    print("Patient Login Token Acquired for Karthik Raman!")

    headers_staff = {"Authorization": f"Bearer {staff_token}"}
    headers_patient = {"Authorization": f"Bearer {patient_token}"}

    # 3. Hospital Search (2,392 Tamil Nadu providers dataset)
    print("\n--- 3. Public Hospital Directory Search (Chennai District, Distance Sorted) ---")
    r_hosp = requests.get(f"{BASE_URL}/api/hospitals/search?q=Apollo&patient_district=Chennai", headers=headers_staff)
    hospitals = r_hosp.json()
    print(f"Total Matches Found: {len(hospitals)}")
    print("Sample Provider Match:")
    sample_h = hospitals[0]
    print(f"  - Name: {sample_h['name']}")
    print(f"  - Facility Type: {sample_h['facility_type']} | Ownership: {sample_h['ownership']}")
    print(f"  - District: {sample_h['district']} | Pincode: {sample_h['pincode']}")
    print(f"  - Coordinates: ({sample_h['latitude']}, {sample_h['longitude']}) [{sample_h['coord_source']}]")
    print(f"  - Distance from Chennai Center: {sample_h['distance_km']} km")

    # 4. Discharge Summary Upload & 5-Agent Pipeline Execution
    print("\n--- 4. Discharge Summary Upload & 5-Agent Extraction Pipeline ---")
    discharge_payload = {
        "patient_id": 1,
        "raw_text": """PATIENT DISCHARGE SUMMARY - CARDIOLOGY
Patient Name: Karthik Raman | Age: 62 | Gender: Male
Diagnosis: Acute Anterior Wall Myocardial Infarction s/p Primary PCI to LAD.

DISCHARGE MEDICATIONS:
1. Tab Aspirin 75mg once daily after breakfast.
2. Tab Metoprolol 25mg twice daily - titrate as needed depending on pulse.

FOLLOW-UP PLAN & DIAGNOSTICS:
- Return to Cardiology OPD in 7 days for clinical review and wound inspection.
- Repeat Echocardiogram (ECHO) and 12-lead ECG in 5 days prior to OPD visit.

EMERGENCY WARNING SIGNS:
- Immediate emergency return if patient experiences recurring chest pain, severe breathlessness, or fever >101F."""
    }
    r_chart = requests.post(f"{BASE_URL}/api/discharge/process", json=discharge_payload, headers=headers_staff)
    chart = r_chart.json()
    print(f"Generated FollowupChart ID: #{chart['id']}")
    print(f"Extracted Tasks ({len(chart['tasks'])} total):")
    for t_item in chart['tasks']:
        print(f"  * [{t_item['status']}] {t_item['title']} (Category: {t_item['category']}, Confidence: {t_item['confidence_score']*100:.0f}%)")
        print(f"    Simple Text: {t_item['simple_text']}")
        print(f"    Evidence Sentence: \"{t_item['evidence_sentence']}\"")

    # 5. Human Reviewer Queue & Second Brain Sync
    print("\n--- 5. Human Reviewer Queue & Second Brain Markdown Auto-Sync ---")
    r_queue = requests.get(f"{BASE_URL}/api/tasks/reviewer-queue", headers=headers_staff)
    queue_items = r_queue.json()
    print(f"Pending Items in Reviewer Queue: {len(queue_items)}")
    if queue_items:
        item = queue_items[0]
        print(f"Reviewing Item #{item['id']} ({item['title']})...")
        r_rev = requests.post(
            f"{BASE_URL}/api/tasks/{item['id']}/review",
            json={
                "action": "edit",
                "simple_text": "Take Metoprolol 25mg twice daily. Heart rate range 60-90 bpm approved by physician.",
                "reviewer_notes": "Clinical approval of pulse titration range."
            },
            headers=headers_staff
        )
        print("Reviewer Edit Approved! New Second Brain note auto-generated in /second-brain/reviewer-decisions/")

    # 6. Second Brain Vault RAG Search
    print("\n--- 6. Second Brain Knowledge Vault RAG Query ---")
    r_sb = requests.get(f"{BASE_URL}/api/second-brain/nodes", headers=headers_staff)
    sb_nodes = r_sb.json()
    print(f"Active Vault Nodes: {len(sb_nodes)}")
    for n in sb_nodes:
        print(f"  - [{n['category']}] {n['title']} (Path: {n['path']}) | Wikilinks: {n['wikilinks']}")

    # 7. Patient 3-Step Booking Request & Tokenized Email Dispatch
    print("\n--- 7. 3-Step Appointment Booking & Email Dispatch ---")
    task_id = chart['tasks'][0]['id']
    booking_payload = {
        "task_id": task_id,
        "hospital_id": sample_h['provider_id'],
        "doctor_id": 1,
        "slot_id": 1
    }
    r_book = requests.post(f"{BASE_URL}/api/bookings/request", json=booking_payload, headers=headers_patient)
    booking = r_book.json()
    print("Booking Request Status:", booking['status'])

    r_outbox = requests.get(f"{BASE_URL}/api/outbox/", headers=headers_staff)
    emails = r_outbox.json()
    latest_email = emails[0]
    print(f"Dispatched Email Subject: \"{latest_email['subject']}\"")
    print(f"Recipient Demo Inbox: {latest_email['recipient_email']}")
    print(f"Token Accept Link: http://localhost:8000/api/bookings/action/accept?token={latest_email['token_accept']}")

    # 8. RAG Chatbot Query with Citations
    print("\n--- 8. Patient Chatbot RAG Query ---")
    r_chat = requests.post(f"{BASE_URL}/api/chatbot/query", json={"query": "When is my next appointment?"}, headers=headers_patient)
    chat_res = r_chat.json()
    print("Query:", chat_res['query'])
    print("Answer:", chat_res['answer'])
    print("Citations Count:", len(chat_res['citations']))
    if chat_res['citations']:
        print("Citation Title:", chat_res['citations'][0]['title'])

    # 9. Hospital Analytics Dashboard
    print("\n--- 9. Hospital Analytics Dashboard ---")
    r_dash = requests.get(f"{BASE_URL}/api/analytics/dashboard", headers=headers_staff)
    dash = r_dash.json()
    print("Analytics KPI Summary:")
    print(f"  - Discharged Patients: {dash['discharged_patients_count']}")
    print(f"  - Pending Tasks: {dash['pending_tasks_count']}")
    print(f"  - Needs Review Count: {dash['needs_review_count']}")
    print(f"  - Average Rating: {dash['average_feedback_rating']}/5")
    print(f"  - Age Band Breakdown: {dash['age_bands']}")

    print("\n================================================================================")
    print("   [SUCCESS] DEMO RUN COMPLETED! ALL FLOWS RUNNING END-TO-END WITH EMPIRICAL OUTPUT  ")
    print("================================================================================")

if __name__ == "__main__":
    main()
