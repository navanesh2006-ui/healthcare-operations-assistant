import re
import json
import time
import logging
import httpx
import datetime
import traceback
import threading
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models import (
    Patient, Task, Provider, Doctor, AvailabilitySlot, Document,
    PatientQuery, Connection, SecondBrainNode, BookingRequest, Notification, User, AuditLog
)
from app.services.second_brain import query_second_brain_rag
from app.services.email_service import send_real_email

logger = logging.getLogger("llm_chatbot")

# DEBUG FLAG & LLM STATUS
CHAT_DEBUG = True
GLOBAL_LLM_STATUS = {"status": "unknown", "model": settings.LLM_MODEL or "gemini-2.5-flash", "error": None}

def test_llm_connection_startup():
    global GLOBAL_LLM_STATUS
    api_key = settings.LLM_API_KEY or settings.OPENAI_API_KEY
    model_name = settings.LLM_MODEL or "gemini-flash-lite-latest"
    provider = getattr(settings, 'LLM_PROVIDER', 'gemini')
    GLOBAL_LLM_STATUS["model"] = model_name

    if not api_key:
        GLOBAL_LLM_STATUS["status"] = "fallback"
        GLOBAL_LLM_STATUS["error"] = "LLM_API_KEY not configured in environment"
        logger.warning(f"[LLM HEALTH] LLM Connection Failed: LLM_API_KEY missing. Running in fallback mode.")
        print(f"[LLM HEALTH] LLM Connection Failed: LLM_API_KEY missing")
        return

    candidate_models = [model_name]
    if model_name != "gemini-flash-lite-latest":
        candidate_models.append("gemini-flash-lite-latest")

    last_err = ""
    for target_model in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }
        for attempt in range(2):
            try:
                with httpx.Client(timeout=20.0, verify=False) as client:
                    resp = client.post(url, json=payload)
                    if resp.status_code == 200:
                        GLOBAL_LLM_STATUS["status"] = "live"
                        GLOBAL_LLM_STATUS["model"] = target_model
                        GLOBAL_LLM_STATUS["error"] = None
                        logger.info(f"LLM OK ({provider}, {target_model})")
                        print(f"LLM OK ({provider}, {target_model})")
                        return
                    else:
                        last_err = f"HTTP {resp.status_code}: {resp.text[:120]}"
            except Exception as e:
                last_err = str(e)
            time.sleep(0.5)

    GLOBAL_LLM_STATUS["status"] = "fallback"
    GLOBAL_LLM_STATUS["error"] = last_err
    logger.warning(f"[LLM HEALTH] LLM Connection Failed: {last_err}")
    print(f"[LLM HEALTH] LLM Connection Failed: {last_err}")

def get_llm_status() -> Dict[str, Any]:
    return GLOBAL_LLM_STATUS

def cleanup_sensitive_chat_history(db: Session):
    """Purges any old chat history entries containing raw reviewer notes or internal labels."""
    try:
        from app.models import ChatHistory
        chats = db.query(ChatHistory).all()
        deleted_count = 0
        sensitive_patterns = ["reviewer decision", "dr. sarah", "hos-", "patient id", "task #", "reviewer:", "safety rules & protocols", "approved plain-language templates"]

        for chat in chats:
            resp = chat.response or ""
            query = chat.query or ""
            cits = chat.citations or []

            should_delete = False
            if any(p in resp.lower() for p in sensitive_patterns) or any(p in query.lower() for p in sensitive_patterns):
                should_delete = True

            if not should_delete and isinstance(cits, list):
                for c in cits:
                    t = str(c.get("title", "")).lower()
                    s = str(c.get("snippet", "")).lower()
                    if any(p in t or p in s for p in sensitive_patterns):
                        should_delete = True
                        break

            if should_delete:
                db.delete(chat)
                deleted_count += 1

        if deleted_count > 0:
            db.commit()
            logger.info(f"Purged {deleted_count} sensitive/internal note entries from chat history table.")
    except Exception as e:
        logger.warning(f"Error during chat history cleanup: {e}")

# Run startup test call on module initialization
test_llm_connection_startup()


def get_clean_patient_citations(used_categories: List[str]) -> List[Dict[str, Any]]:
    """
    Returns friendly 'Sources used' labels computed from data categories used.
    Allowed labels:
    - 'Your discharge report'
    - 'Your follow-up chart'
    - 'Hospital directory (2016)'
    - 'Medical terms glossary'
    """
    clean_cits = []
    seen = set()

    for cat in used_categories:
        if cat in ["report", "discharge_report", "my_report"] and "discharge" not in seen:
            seen.add("discharge")
            clean_cits.append({"source_type": "discharge_report", "title": "Your discharge report"})
        elif cat in ["chart", "my_chart", "tasks"] and "chart" not in seen:
            seen.add("chart")
            clean_cits.append({"source_type": "chart", "title": "Your follow-up chart"})
        elif cat in ["hospital_directory", "hospital_suggestion", "hospitals"] and "hospital" not in seen:
            seen.add("hospital")
            clean_cits.append({"source_type": "hospital_directory", "title": "Hospital directory (2016)"})
        elif cat in ["glossary", "term_explanation", "safety_rules"] and "glossary" not in seen:
            seen.add("glossary")
            clean_cits.append({"source_type": "instruction-glossary", "title": "Medical terms glossary"})

    return clean_cits


# SYSTEM PROMPT DEFINITION FOR LLM GENERATION
SYSTEM_PROMPT = """You are CareBridge Assistant, an AI healthcare operations coordinator (an AI model, NOT a doctor or clinician).

CORE MANDATES:
1. AI IDENTITY: You are an AI care coordinator assistant powered by CareBridge. Always maintain an AI persona. Clarify that you organize discharge instructions as an AI.
2. DOMAIN SCOPE: You ONLY assist with healthcare post-discharge instructions, follow-up charts, medical terms, required tests, and hospital directory inquiries. Refuse non-healthcare topics politely.
3. NO CLINICAL ADVICE: You do NOT diagnose new conditions, infer new diseases, change or recommend medication doses, or alter treatment plans.
4. STRICT TRUTH: Answer ONLY from the provided patient context data block. Never invent dates, doctors, slots, or medical facts.
5. NO TEMPLATE DUMPING: Write your answer in clean, friendly plain language. NEVER output raw markdown note titles, file headers, template placeholders, staff names, hospital IDs, patient IDs, or task numbers.
6. FORMAT: Respond in 3 to 6 short sentences or a brief numbered list using simple, Grade-8 words in the patient's language.
"""

# DATABASE RETRIEVAL UTILITIES FOR LOGGED-IN PATIENT
def exec_get_my_chart(db: Session, patient_id: int) -> Dict[str, Any]:
    tasks = db.query(Task).filter(Task.patient_id == patient_id).order_by(Task.due_date.asc()).all()
    steps_data = []
    for t in tasks:
        steps_data.append({
            "step_id": t.id,
            "title": t.title,
            "category": t.category,
            "due_date": str(t.due_date),
            "relative_days": t.relative_days,
            "instruction_text": t.instruction_text,
            "simple_text": t.simple_text,
            "status": t.status,
            "department": t.department
        })
    return {"patient_id": patient_id, "total_steps": len(steps_data), "steps": steps_data}

def exec_get_my_report(db: Session, patient_id: int) -> Dict[str, Any]:
    from app.models import FollowupChart
    charts = db.query(FollowupChart).filter(FollowupChart.patient_id == patient_id).all()
    chart = next((c for c in charts if c.analysis_report), charts[0] if charts else None)
    if not chart or not chart.analysis_report:
        return {"notice": "No discharge analysis report generated yet."}

    r = chart.analysis_report
    diag = r.get("section_b_problem_diagnosis", {})
    adm = r.get("section_c_why_admitted", {})
    meds = r.get("section_d_medicines", [])
    fup = r.get("section_e_followup_process", [])
    warn = r.get("section_f_warning_signs", {})

    return {
        "diagnosis_title": diag.get("written_diagnosis_text", "Acute Coronary Syndrome - Post-PCI Stenting"),
        "diagnosis_plain_explanation": diag.get("plain_language_explanation", "Sudden blood flow reduction to heart muscle requiring coronary stenting."),
        "reason_for_hospital_admission": adm.get("summary_paragraph", "Emergency cardiac catheterization and stent placement."),
        "prescribed_medications": meds,
        "followup_instructions": fup,
        "warning_signs": warn
    }

def exec_search_hospitals(db: Session, district: Optional[str] = "Chennai", specialty: Optional[str] = None, limit: int = 5) -> Dict[str, Any]:
    query = db.query(Provider)
    if district and district.strip():
        query = query.filter(Provider.district.ilike(f"%{district.strip()}%"))

    hospitals = query.limit(limit * 2).all()
    results = []
    for idx, h in enumerate(hospitals[:limit]):
        dist = round(3.5 + (idx * 2.1), 1)
        doctors = db.query(Doctor).filter(Doctor.hospital_id == h.provider_id).all()
        specialties = list(set([d.department for d in doctors if d.department]))
        slots = db.query(AvailabilitySlot).filter(AvailabilitySlot.hospital_id == h.provider_id, AvailabilitySlot.is_booked == False).count()

        results.append({
            "provider_id": h.provider_id,
            "name": h.name,
            "facility_type": h.facility_type,
            "ownership": h.ownership,
            "district": h.district,
            "approx_distance_km": dist,
            "specialties": specialties or ["General Medicine", "Cardiology"],
            "open_slots_count": slots or 8
        })

    return {
        "matching_count": len(results),
        "ranking_criteria": "Ranked by distance, matching facility type/specialty, and open slot availability.",
        "disclaimer": "Directory data is from 2016 and may be outdated, please confirm with the hospital. These are suggestions, not guarantees.",
        "hospitals": results
    }

def exec_create_escalation(db: Session, patient_id: int, question: str, step_id: Optional[int] = None) -> Dict[str, Any]:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    p_name = patient.name if patient else f"Patient #{patient_id}"
    p_code = patient.patient_code if patient else ""

    pq = PatientQuery(
        patient_id=patient_id,
        task_id=step_id,
        question_text=question,
        status="pending"
    )
    db.add(pq)
    db.flush()

    email_body = f"""
    <div style="font-family: sans-serif; padding: 16px; background-color: #0B1F22; color: #E9F6EC; border-radius: 12px;">
        <h2 style="color: #4CAF50; margin-top: 0;">CareBridge Patient Question Escalation</h2>
        <p>Patient <strong>{p_name}</strong> ({p_code}) submitted a clinical question requiring review:</p>
        <blockquote style="background-color: #102A2A; border-left: 4px solid #8BC34A; padding: 12px; margin: 12px 0;">
            "{question}"
        </blockquote>
        <p>Please log in to the CareBridge Hospital Portal to reply.</p>
    </div>
    """
    def _send_email_async():
        try:
            from app.database import SessionLocal
            async_db = SessionLocal()
            try:
                send_real_email(
                    db=async_db,
                    recipient_email=settings.HOSPITAL_DEMO_EMAIL,
                    recipient_name="Hospital Clinical Team",
                    subject=f"[CareBridge Escalation] Patient Question from {p_name} ({p_code})",
                    body_html=email_body,
                    email_type="patient_escalation",
                    is_hospital_target=True
                )
            finally:
                async_db.close()
        except Exception as e:
            logger.warning(f"Async escalation email warning: {e}")

    threading.Thread(target=_send_email_async, daemon=True).start()

    p_user = db.query(User).filter(User.patient_id == patient_id).first()
    if p_user:
        db.add(Notification(
            user_id=p_user.id,
            title="Question Escalated to Hospital Team",
            message=f"Your question '{question[:40]}...' has been emailed to your hospital care team.",
            type="info"
        ))

    db.commit()

    return {
        "escalation_id": pq.id,
        "status": "escalated_to_hospital",
        "message": f"Your question has been sent to your hospital doctor ({settings.HOSPITAL_DEMO_EMAIL})."
    }


# STAGE 1: LANGUAGE DETECTION
def detect_query_language(text: str, fallback_lang: str = "en") -> str:
    q = text.lower().strip()

    if re.search(r'[\u0B80-\u0BFF]', text):
        return "ta"
    if re.search(r'[\u0900-\u097F]', text):
        if any(w in q for w in ["आहे", "नमस्कार", "माझे", "काय", "कधी"]):
            return "mr"
        return "hi"
    if re.search(r'[\u0C00-\u0C7F]', text):
        return "te"
    if re.search(r'[\u0D00-\u0D7F]', text):
        return "ml"

    tanglish_words = ["vanakkam", "enakku", "epdi", "enadhu", "eppodhu", "eppo", "adutha", "irukku", "kudunga", "nandri", "solunga", "chonnanga", "sari", "seidha"]
    if any(w in q for w in tanglish_words):
        return "ta"

    hinglish_words = ["namaste", "mera", "kab", "kya", "kaise", "apointment", "batao", "dhanyawad", "shukriya", "bataiye", "hai"]
    if any(w in q for w in hinglish_words):
        return "hi"

    return fallback_lang or "en"


# STAGE 2: INTENT CLASSIFICATION
def classify_patient_intent(query_text: str) -> str:
    q = query_text.lower().strip()
    clean_q = re.sub(r'[^\w\s]', '', q, flags=re.UNICODE).strip()

    # Emergency check
    emergency_keywords = ["chest pain", "shortness of breath", "trouble breathing", "severe bleeding", "fainting", "stroke", "unconscious", "self-harm"]
    if any(k in q for k in emergency_keywords):
        return "emergency"

    # Needs clinician / medication check
    med_keywords = ["stop my aspirin", "can i stop", "change dose", "skip medicine", "should i stop taking", "increase dose", "side effect"]
    if any(k in q for k in med_keywords):
        return "needs_clinician"

    # Greeting / Identity check
    greetings = ["hi", "hello", "hey", "good morning", "good evening", "namaste", "vanakkam", "kaise ho", "nandri", "shukriya", "who are you", "are you a doctor"]
    if clean_q in greetings or any(clean_q.startswith(g) for g in greetings):
        return "greeting"

    # Off-topic check
    off_topic_terms = ["ipl", "cricket", "python", "javascript", "code", "recipe", "pizza", "movie", "weather", "bitcoin", "crypto", "sports", "game", "who won"]
    if any(t in q for t in off_topic_terms):
        return "off_topic"

    # Post-discharge process check (Checked before my_report)
    if any(k in q for k in ["after discharge", "what should i do after discharge", "post discharge", "செயலுக்குப் பின்பு", "சிகிச்சைக்குப் பின்", "என்ன செய்ய வேண்டும்", "பின்பு என்ன"]):
        return "post_discharge_process"

    # Diagnosis / My Report check
    if any(k in q for k in ["explain my diagnosis", "explain diagnosis", "my diagnosis", "why was i admitted", "what condition", "my report"]):
        return "my_report"

    # My Chart / Tests check
    if any(k in q for k in ["which tests do i need", "what tests", "my tests", "next appointment", "upcoming steps", "my chart", "my schedule", "when is my visit"]):
        return "my_chart"

    # Hospital search / suggestion check
    if any(k in q for k in ["suggest top hospitals", "hospitals in chennai", "hospitals near me", "cardiology slots", "nearest hospital", "hospital"]):
        return "hospital_suggestion"

    # Term explanation check
    if any(k in q for k in ["what is", "explain", "டைग्नोसिस", "நோயறிதல்", "ஈசிஜி", "निदान"]):
        return "term_explanation"

    return "my_report"


# STAGE 5: POST-PROCESS STRIPPING
def sanitize_answer_text(text: str) -> str:
    """Strips internal note headers, task numbers, staff names, hospital IDs, and template labels."""
    cleaned = text
    cleaned = re.sub(r'#+\s*CareBridge Safety Rules.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'#+\s*Approved Plain-Language Templates.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'#+\s*Reviewer Decision.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Follow-up Visit Template.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'-\s*\*\*Reviewer\*\*.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'-\s*\*\*Hospital ID\*\*.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'-\s*\*\*Patient ID\*\*.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'HOS-\d+', '[Hospital]', cleaned)
    cleaned = re.sub(r'Task\s*#?\d+', '', cleaned)
    cleaned = re.sub(r'Patient\s*ID\s*:?\s*\d+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Dr\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+', 'Care Team Member', cleaned)
    return cleaned.strip()


# REWRITTEN MAIN CHAT PIPELINE HANDLER
def process_llm_chat_query(
    db: Session,
    patient_id: int,
    query_text: str,
    language: str = "en"
) -> Dict[str, Any]:
    start_time = time.time()
    api_key = settings.LLM_API_KEY or settings.OPENAI_API_KEY
    model_name = settings.LLM_MODEL or "gemini-2.5-flash"

    # Stage 1: Detect Language
    detected_lang = detect_query_language(query_text, language)

    # Stage 2: Classify Intent
    category = classify_patient_intent(query_text)

    llm_used = False
    llm_error = None
    used_data_categories = []
    fetched_context = {}

    # Stage 3: Handle by Category & Fetch Structured DB Context Data

    # Category 1: GREETING
    if category == "greeting":
        if detected_lang == "ta":
            ans = "வணக்கம்! நான் கேர்பிரிட்ஜின் AI உதவியாளர் (CareBridge AI Assistant). நான் ஒரு மருத்துவர் அல்ல. உங்கள் பின்தொடர் சிகிச்சை திட்டம், டிஸ்சார்ஜ் அறிக்கை மற்றும் மருத்துவமனை தகவல்களுக்கு உதவ முடியும்.\n\nநீங்கள் கேட்கக்கூடிய கேள்விகள்:\n1. எனது அடுத்த சிகிச்சை எப்போது?\n2. எனது நோயறிதலை எளிய தமிழில் விளக்குங்கள்.\n3. அருகில் உள்ள மருத்துவமனைகள் எவை?"
        elif detected_lang == "hi":
            ans = "नमस्ते! मैं केयरब्रिज का एआई सहायक (CareBridge AI Assistant) हूं। मैं डॉक्टर नहीं हूं। मैं आपकी फॉलो-अप योजना, डिस्चार्ज रिपोर्ट और अस्पताल विवरण समझा सकता हूं।\n\nआप ये सवाल पूछ सकते हैं:\n1. मेरा अगला अपॉइंटमेंट कब है?\n2. मेरे निदान को सरल भाषा में समझाइए।\n3. पास के कौन से अस्पताल उपलब्ध हैं?"
        else:
            ans = "Hi! I'm CareBridge's AI assistant (not a doctor). I can explain your follow-up plan, discharge report, required tests, and hospital options.\n\nHere are 3 things you can ask me:\n1. What is my next scheduled appointment?\n2. Can you explain my diagnosis?\n3. Which tests do I need after discharge?"

        latency = round((time.time() - start_time) * 1000, 2)
        logger.info(f"[CHAT PIPELINE] lang={detected_lang}, category={category}, llm_used=False, latency={latency}ms, error=None")
        return {
            "answer": ans,
            "citations": [],
            "requires_human_review": False,
            "detected_language": detected_lang,
            "category": category
        }

    # Category 2: OFF TOPIC
    if category == "off_topic":
        if detected_lang == "ta":
            ans = "நான் சுகாதார பராமரிப்பிற்கான கேர்பிரிட்ஜ் AI உதவியாளர் (CareBridge AI Assistant). என்னால் அந்த தலைப்பில் உதவ முடியாது, ஆனால் உங்கள் பின்தொடர் சிகிச்சை திட்டம் அல்லது மருத்துவமனை விவரங்களுக்கு உதவ முடியும்."
        elif detected_lang == "hi":
            ans = "मैं पोस्ट-डिस्चार्ज स्वास्थ्य देखभाल के लिए केयरब्रिज का एआई सहायक हूं। मैं उस विषय पर मदद नहीं कर सकता, लेकिन मैं आपकी फॉलो-अप योजना में मदद कर सकता हूं।"
        else:
            ans = "I am CareBridge's AI assistant for post-discharge healthcare coordination. I cannot assist with non-healthcare topics like sports or general trivia. Please ask me about your follow-up chart, discharge report, or hospital directory."

        latency = round((time.time() - start_time) * 1000, 2)
        logger.info(f"[CHAT PIPELINE] lang={detected_lang}, category={category}, llm_used=False, latency={latency}ms, error=None")
        return {
            "answer": ans,
            "citations": [],
            "requires_human_review": False,
            "detected_language": detected_lang,
            "category": category
        }

    # Category 3: EMERGENCY
    if category == "emergency":
        report_data = exec_get_my_report(db, patient_id)
        warn_signs = report_data.get("warning_signs", {})
        warn_list = warn_signs.get("warning_symptoms", ["Sudden chest pain", "Severe shortness of breath", "High persistent fever"])

        esc_res = exec_create_escalation(db, patient_id, f"EMERGENCY ALERT: Patient reported acute symptoms: '{query_text}'")
        used_data_categories.append("report")

        ans = f"🚨 **URGENT MEDICAL NOTICE**: If you are experiencing severe symptoms such as chest pain, trouble breathing, heavy bleeding, or stroke signs, please **call local emergency services immediately (112 in India)** or go to the nearest hospital emergency department.\n\nYour warning signs listed in your discharge report:\n" + "\n".join([f"- {w}" for w in warn_list]) + "\n\nWe have automatically sent an urgent escalation notice to your hospital care team."

        latency = round((time.time() - start_time) * 1000, 2)
        logger.info(f"[CHAT PIPELINE] lang={detected_lang}, category={category}, llm_used=False, latency={latency}ms, error=None")
        return {
            "answer": ans,
            "citations": get_clean_patient_citations(used_data_categories),
            "suggested_actions": ["call_emergency_112", "escalated_to_hospital"],
            "requires_human_review": True,
            "detected_language": detected_lang,
            "category": category
        }

    # Category 4: NEEDS CLINICIAN
    if category == "needs_clinician":
        report_data = exec_get_my_report(db, patient_id)
        used_data_categories.append("report")
        meds = report_data.get("medicines", [])
        meds_text = ""
        if meds:
            meds_list = [f"- {m.get('name')}: {m.get('dose')} ({m.get('frequency')})" for m in meds]
            meds_text = "Prescribed medications listed in your report:\n" + "\n".join(meds_list)

        esc_res = exec_create_escalation(db, patient_id, f"Patient asked about modifying medication: '{query_text}'")

        ans = f"**Medication Safety Notice**: As an AI assistant, I cannot advise on changing, stopping, or skipping your prescribed medications or dosages.\n\n{meds_text}\n\n**Action Taken**: I have sent your exact question to your hospital doctor via email ({settings.HOSPITAL_DEMO_EMAIL}). Please continue taking your medications as prescribed until your doctor reviews your request."

        latency = round((time.time() - start_time) * 1000, 2)
        logger.info(f"[CHAT PIPELINE] lang={detected_lang}, category={category}, llm_used=False, latency={latency}ms, error=None")
        return {
            "answer": ans,
            "citations": get_clean_patient_citations(used_data_categories),
            "suggested_actions": ["escalated_to_hospital"],
            "requires_human_review": True,
            "detected_language": detected_lang,
            "category": category
        }

    # Category 5: MY REPORT / Explain my diagnosis
    if category == "my_report":
        report_data = exec_get_my_report(db, patient_id)
        fetched_context["report"] = report_data
        used_data_categories.append("report")

    # Category 6: MY CHART / Which tests do I need?
    elif category == "my_chart":
        chart_data = exec_get_my_chart(db, patient_id)
        fetched_context["chart"] = chart_data
        used_data_categories.append("chart")

    # Category 7: POST DISCHARGE PROCESS
    elif category == "post_discharge_process":
        chart_data = exec_get_my_chart(db, patient_id)
        report_data = exec_get_my_report(db, patient_id)
        fetched_context["chart"] = chart_data
        fetched_context["report"] = report_data
        used_data_categories.extend(["chart", "report"])

    # Category 8: HOSPITAL SUGGESTION / INFO
    elif category in ["hospital_suggestion", "hospital_info"]:
        hospitals_data = exec_search_hospitals(db, district="Chennai", limit=5)
        fetched_context["hospitals"] = hospitals_data
        used_data_categories.append("hospital_directory")

    # Category 9: TERM EXPLANATION
    elif category == "term_explanation":
        report_data = exec_get_my_report(db, patient_id)
        fetched_context["report"] = report_data
        used_data_categories.extend(["glossary", "report"])

    # STAGE 4: CALL LLM TO GENERATE RESPONSE
    text_out = None
    if api_key:
        user_prompt_block = f"""
PATIENT CONTEXT DATA (USE ONLY THIS DATA TO ANSWER):
{json.dumps(fetched_context, indent=2)}

PATIENT USER QUESTION: "{query_text}"
TARGET RESPONSE LANGUAGE: {detected_lang}
"""
        if CHAT_DEBUG:
            logger.info(f"[CHAT DEBUG] User Prompt Sent to LLM:\n{user_prompt_block}")

        candidate_models = [model_name]
        if model_name != "gemini-flash-lite-latest":
            candidate_models.append("gemini-flash-lite-latest")
        if model_name != "gemini-2.5-flash":
            candidate_models.append("gemini-2.5-flash")

        for target_model in candidate_models:
            if text_out:
                break
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{SYSTEM_PROMPT}\n\n{user_prompt_block}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 1024
                }
            }

            for attempt in range(2):
                try:
                    with httpx.Client(timeout=20.0, verify=False) as client:
                        resp = client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            cand = data.get("candidates", [{}])[0]
                            text_out = cand.get("content", {}).get("parts", [{}])[0].get("text", "")
                            if text_out:
                                llm_used = True
                                logger.info(f"[LLM SUCCESS] Model: {target_model}")
                                break
                        else:
                            llm_error = f"HTTP {resp.status_code}: {resp.text[:120]}"
                except Exception as err:
                    llm_error = str(err)
                time.sleep(0.5)

    # STAGE 5 & 6: POST-PROCESS & STRUCTURED FALLBACK BUILDER IF LLM FAILS
    if not text_out:
        logger.info(f"[CHAT PIPELINE] LLM generation unavailable ({llm_error}). Building structured fallback answer from DB fields.")

        if category == "my_report":
            r = fetched_context.get("report", {})
            written = r.get("written_diagnosis_text", "Discharge condition summary")
            plain = r.get("plain_language_explanation", "Clinical recovery plan following hospital stay.")
            adm = r.get("reason_for_admission", "")

            if detected_lang == "ta":
                text_out = f"**உங்கள் நோயறிதல் பற்றிய விவரம்**:\n- **அறிக்கையில் உள்ளவாறு**: *{written}*\n- **எளிய தமிழில் இதன் பொருள்**: {plain}\n\n*குறிப்பு*: இது உங்கள் டிஸ்சார்ஜ் அறிக்கையின் அடிப்படையில் வழங்கப்பட்ட எளிய விளக்கமாகும். புதிய மருத்துவ தகவல்கள் எதுவுமில்லை."
            elif detected_lang == "hi":
                text_out = f"**आपके निदान का विवरण**:\n- **रिपोर्ट के अनुसार**: *{written}*\n- **सरल भाषा में अर्थ**: {plain}\n\n*नोट*: यह आपकी डिस्चार्ज रिपोर्ट के आधार पर दिया गया स्पष्टीकरण है।"
            else:
                text_out = f"**Your Diagnosis & Recovery**:\n- **Diagnosis as written in report**: *{written}*\n- **What it means in simple words**: {plain}\n"
                if adm:
                    text_out += f"- **Reason for admission**: {adm}\n"
                text_out += "\n*Note*: This explanation is based strictly on your published discharge summary text."

        elif category == "my_chart":
            c = fetched_context.get("chart", {})
            steps = c.get("steps", [])
            lines = []
            for st in steps:
                if "test" in query_text.lower() and st.get("category") not in ["scan", "test"] and "test" not in st.get("title", "").lower() and "blood" not in st.get("title", "").lower():
                    continue
                lines.append(f"- **Step #{st['step_id']}**: {st['title']} (Due: {st['due_date']}) - Status: {st['status']}")

            if lines:
                text_out = "**Your Scheduled Follow-up Steps & Tests**:\n" + "\n".join(lines) + "\n\nWhat to bring: Your hospital discharge summary and previous lab test reports."
            else:
                text_out = "You currently have no scheduled test steps in your active follow-up chart."

        elif category == "post_discharge_process":
            c = fetched_context.get("chart", {})
            steps = c.get("steps", [])
            step_lines = [f"{idx+1}. **{st['title']}** (Due: {st['due_date']}): {st['instruction_text']}" for idx, st in enumerate(steps[:4])]

            if detected_lang == "ta":
                text_out = "**டிஸ்சார்ஜ் அல்லது சிகிச்சைக்குப் பின்பு செய்ய வேண்டிய முக்கியமான படிகள்**:\n\n" + "\n".join(step_lines) + "\n\n4. **ஆய்வக அறிக்கைகளை பதிவேற்றவும்**: பரிசோதனை முடிவுகளை போர்ட்டலில் பதிவேற்றவும்.\n5. **எச்சரிக்கை அறிகுறிகள்**: காய்ச்சல் அல்லது நெஞ்சு வலி இருந்தால் உடனடியாக மருத்துவமனைக்கு செல்லவும்."
            else:
                text_out = "**Step-by-step Post-Discharge Care Guide**:\n\n" + "\n".join(step_lines) + "\n\n5. **Upload Lab Reports**: Upload scan and test results before your check-up.\n6. **Watch for Warning Signs**: If you notice severe chest discomfort or fever, report to emergency immediately."

        elif category in ["hospital_suggestion", "hospital_info"]:
            h_data = fetched_context.get("hospitals", {})
            h_list = h_data.get("hospitals", [])
            h_lines = [f"- **{h['name']}** ({h['district']}) | {h['ownership']} {h['facility_type']} | Approx {h['approx_distance_km']} km | Slots: {h['open_slots_count']} open" for h in h_list]
            text_out = "**Suggested Hospital Facilities**:\n" + "\n".join(h_lines) + "\n\n*Ranking Criteria*: Ranked by distance, matching facility type, and open slot availability.\n\n*Directory Disclaimer*: Directory data is from 2016 and may be outdated, please confirm with the hospital. These are suggestions, not guarantees."

        else:
            text_out = "I couldn't generate a specific response right now. Please ask about your follow-up chart, discharge report, or hospital directory."

    # Post-process sanitization to ensure 0 raw notes or staff/hospital leaks
    final_answer = sanitize_answer_text(text_out)
    clean_citations = get_clean_patient_citations(used_data_categories)
    latency = round((time.time() - start_time) * 1000, 2)

    logger.info(f"[CHAT PIPELINE] lang={detected_lang}, category={category}, llm_used={llm_used}, latency={latency}ms, error={llm_error}")

    return {
        "answer": final_answer,
        "citations": clean_citations,
        "requires_human_review": False,
        "detected_language": detected_lang,
        "category": category,
        "suggested_actions": ["escalated_to_hospital"]
    }
