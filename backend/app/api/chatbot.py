import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Patient, Task, Doctor, Provider, ChatHistory, PatientQuery, Task as TaskModel
from app.schemas import ChatQuery, ChatResponse, CitationItem
from app.security import get_current_user_data
from app.services.second_brain import query_second_brain_rag
from app.services.llm_chatbot import process_llm_chat_query, exec_create_escalation, get_llm_status, cleanup_sensitive_chat_history

logger = logging.getLogger("api_chatbot")
router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])

@router.get("/status")
def get_chatbot_status():
    return get_llm_status()

@router.post("/query", response_model=ChatResponse)
def ask_chatbot(
    req: ChatQuery,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query_text = req.query.strip()
    if not query_text:
        raise HTTPException(status_code=400, detail="Query text cannot be empty.")

    if current_user["role"] in ["hospital_staff", "hospital_reviewer"]:
        h_id = current_user["hospital_id"]
        citations = []
        requires_human_review = False

        if "over 60" in query_text.lower() or "overdue" in query_text.lower():
            patients_over_60 = db.query(Patient).filter(Patient.hospital_id == h_id, Patient.age >= 60).all()
            p_ids = [p.id for p in patients_over_60]
            pending_tasks = db.query(TaskModel).filter(TaskModel.patient_id.in_(p_ids), TaskModel.status == "Pending").all()
            p_names = set([p.name for p in patients_over_60])
            answer = f"Found {len(patients_over_60)} patients aged 60+ in your hospital records with {len(pending_tasks)} pending follow-up items. Key patients include: {', '.join(list(p_names)[:5])}."
            citations.append(CitationItem(source_type="patient_record", title="Hospital Patient Database", snippet=f"{len(patients_over_60)} matching records retrieved."))

        elif "doctor" in query_text.lower() or "slot" in query_text.lower():
            doctors = db.query(Doctor).filter(Doctor.hospital_id == h_id).all()
            doc_list = ", ".join([f"{d.name} ({d.department})" for d in doctors])
            answer = f"Your hospital currently has {len(doctors)} active doctors scheduled: {doc_list}. Open slots are available in the schedule tool."
            citations.append(CitationItem(source_type="patient_record", title="Doctor Roster", snippet=doc_list))

        else:
            rag_notes = query_second_brain_rag(db, query_text, hospital_id=h_id)
            if rag_notes:
                answer = f"Based on hospital knowledge vault: {rag_notes[0]['content_snippet']}"
                for r in rag_notes:
                    citations.append(CitationItem(source_type="second_brain", title=r["title"], snippet=r["content_snippet"], url_or_path=r.get("path")))
            else:
                answer = f"Retrieved hospital coordinator records for {current_user.get('name')}. All tasks are active."

        chat = ChatHistory(
            user_id=current_user["user_id"],
            role=current_user["role"],
            query=req.query,
            response=answer,
            citations=[c.model_dump() for c in citations]
        )
        db.add(chat)
        db.commit()

        return ChatResponse(
            query=req.query,
            answer=answer,
            citations=citations,
            requires_human_review=requires_human_review,
            chat_history_id=chat.id
        )

    else:
        # Patient Role: LLM Tool-Using Assistant
        p_id = current_user.get("patient_id")
        if not p_id:
            p = db.query(Patient).filter(Patient.email == current_user["email"]).first()
            p_id = p.id if p else 1

        lang = req.language or "en"
        llm_res = process_llm_chat_query(db, p_id, query_text, language=lang)

        citations_out = [
            CitationItem(
                source_type=c.get("source_type", "discharge_report"),
                title=c.get("title", "Patient Record"),
                snippet=c.get("snippet", ""),
                url_or_path=c.get("url_or_path")
            )
            for c in llm_res.get("citations", [])
        ]

        chat = ChatHistory(
            user_id=current_user["user_id"],
            role=current_user["role"],
            query=req.query,
            response=llm_res["answer"],
            citations=[c.model_dump() for c in citations_out]
        )
        db.add(chat)
        db.commit()

        return ChatResponse(
            query=req.query,
            answer=llm_res["answer"],
            citations=citations_out,
            requires_human_review=llm_res.get("requires_human_review", False),
            suggested_actions=llm_res.get("suggested_actions", []),
            offline_fallback=llm_res.get("offline_fallback", False),
            chat_history_id=chat.id,
            detected_language=llm_res.get("detected_language", lang),
            classified_category=llm_res.get("category", "in_scope")
        )

@router.get("/history")
def get_chat_history(
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    cleanup_sensitive_chat_history(db)
    history = db.query(ChatHistory).filter(ChatHistory.user_id == current_user["user_id"]).order_by(ChatHistory.timestamp.asc()).all()
    return [
        {
            "id": h.id,
            "role": h.role,
            "query": h.query,
            "response": h.response,
            "citations": h.citations,
            "timestamp": h.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for h in history
    ]

@router.post("/tts")
def text_to_speech(payload: dict = Body(...)):
    import re, io, wave, math, struct
    from fastapi.responses import Response
    
    text = payload.get("text", "")
    language = payload.get("language", "en")
    
    # Strip IDs and metadata labels before reading out
    clean_text = re.sub(r'HOS-\d+|Task\s*#?\d+|Patient\s*#?\d+|\[\[.*?\]\]', '', text)
    clean_text = re.sub(r'[*#_`>]', '', clean_text).strip()
    
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(8000)
        for i in range(8000):
            val = int(800.0 * math.sin(2.0 * math.pi * 440.0 * (i / 8000.0)))
            wav_file.writeframes(struct.pack('<h', val))
            
    buf.seek(0)
    return Response(content=buf.read(), media_type="audio/wav")

@router.post("/stt")
def speech_to_text(payload: dict = Body(...)):
    language = payload.get("language", "en")
    transcript = payload.get("transcript", "What is my next appointment?")
    return {"transcript": transcript, "language": language}

@router.post("/feedback")
def submit_chat_feedback(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    chat_id = payload.get("chat_history_id")
    feedback_type = payload.get("feedback") # thumbs_up or thumbs_down
    if not chat_id or not feedback_type:
        raise HTTPException(status_code=400, detail="chat_history_id and feedback are required.")
    
    chat = db.query(ChatHistory).filter(ChatHistory.id == chat_id, ChatHistory.user_id == current_user["user_id"]).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat entry not found.")
    
    chat.feedback = feedback_type
    db.commit()
    return {"message": f"Feedback '{feedback_type}' saved to database.", "chat_history_id": chat_id}

@router.post("/escalate")
def escalate_to_hospital(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    question = payload.get("question", "")
    step_id = payload.get("step_id")
    p_id = current_user.get("patient_id") or 1

    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")

    res = exec_create_escalation(db, p_id, question, step_id)
    return res

@router.delete("/clear")
def clear_chat_history(
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    db.query(ChatHistory).filter(ChatHistory.user_id == current_user["user_id"]).delete()
    db.commit()
    return {"message": "Chat history cleared successfully."}
