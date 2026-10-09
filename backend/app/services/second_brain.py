import os
import re
import glob
import json
import logging
import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import SecondBrainNode, AuditLog

logger = logging.getLogger("second_brain")

def extract_wikilinks(text: str) -> List[str]:
    """Extract [[wikilink]] references from markdown text."""
    matches = re.findall(r'\[\[(.*?)\]\]', text)
    return [m.strip() for m in matches]

def extract_frontmatter_and_content(text: str) -> tuple[dict, str]:
    """Parses basic YAML frontmatter if present, else returns empty dict and content."""
    frontmatter = {}
    content = text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            raw_fm = parts[1]
            content = parts[2].strip()
            for line in raw_fm.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    frontmatter[k.strip()] = v.strip().strip('"\'')
    return frontmatter, content

def generate_simple_embedding(text: str) -> List[float]:
    """
    Generates a normalized 64-dim synthetic TF-IDF / character frequency embedding for local vector similarity
    when external embedding APIs are not used.
    """
    import math
    vec = [0.0] * 64
    for i, char in enumerate(text.lower()):
        idx = ord(char) % 64
        vec[idx] += 1.0
    norm = math.sqrt(sum(v*v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def sync_second_brain_files_to_db(db: Session, base_dir: str = "second-brain") -> int:
    """Scans the second-brain folder, parses all .md files, and syncs into second_brain_nodes table."""
    if not os.path.exists(base_dir):
        # Look in parent folder if running inside backend/
        if os.path.exists(os.path.join("..", base_dir)):
            base_dir = os.path.join("..", base_dir)
        else:
            os.makedirs(base_dir, exist_ok=True)
            
    md_files = glob.glob(os.path.join(base_dir, "**", "*.md"), recursive=True)
    synced_count = 0

    for file_path in md_files:
        try:
            rel_path = os.path.relpath(file_path, base_dir).replace("\\", "/")
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                raw_text = f.read()

            fm, content = extract_frontmatter_and_content(raw_text)
            title = fm.get("title") or os.path.splitext(os.path.basename(file_path))[0].replace("-", " ").title()
            category = fm.get("category") or rel_path.split("/")[0] if "/" in rel_path else "general"
            hospital_id = fm.get("hospital_id")
            patient_id = int(fm.get("patient_id")) if fm.get("patient_id") and fm.get("patient_id").isdigit() else None
            visibility = fm.get("visibility") or ("patient_private" if patient_id else "public")

            wikilinks = extract_wikilinks(raw_text)
            embedding_vector = generate_simple_embedding(content)

            existing = db.query(SecondBrainNode).filter(SecondBrainNode.path == rel_path).first()
            if existing:
                existing.title = title
                existing.category = category
                existing.content = content
                existing.wikilinks = wikilinks
                existing.hospital_id = hospital_id
                existing.patient_id = patient_id
                existing.visibility = visibility
                existing.embedding_json = embedding_vector
                existing.updated_at = datetime.datetime.utcnow()
            else:
                node = SecondBrainNode(
                    path=rel_path,
                    title=title,
                    category=category,
                    content=content,
                    wikilinks=wikilinks,
                    hospital_id=hospital_id,
                    patient_id=patient_id,
                    visibility=visibility,
                    embedding_json=embedding_vector
                )
                db.add(node)
            synced_count += 1
        except Exception as e:
            logger.error(f"Error syncing second brain file {file_path}: {e}")

    db.commit()
    logger.info(f"Synced {synced_count} Second Brain nodes into database.")
    return synced_count

def write_reviewer_decision_to_second_brain(
    db: Session,
    task_id: int,
    reviewer_name: str,
    original_text: str,
    corrected_text: str,
    decision_reason: str,
    hospital_id: str,
    patient_id: int,
    base_dir: str = "second-brain"
) -> SecondBrainNode:
    """Writes a human reviewer's decision into /second-brain/reviewer-decisions/ as a markdown note and syncs DB."""
    if not os.path.exists(base_dir) and os.path.exists(os.path.join("..", base_dir)):
        base_dir = os.path.join("..", base_dir)

    target_dir = os.path.join(base_dir, "reviewer-decisions")
    os.makedirs(target_dir, exist_ok=True)

    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_name = f"REV_TASK_{task_id}_{timestamp}.md"
    file_path = os.path.join(target_dir, file_name)
    rel_path = f"reviewer-decisions/{file_name}"

    md_content = f"""---
title: "Reviewer Decision for Task #{task_id}"
category: "reviewer-decisions"
hospital_id: "{hospital_id}"
patient_id: {patient_id}
reviewer: "{reviewer_name}"
date: "{datetime.datetime.utcnow().isoformat()}"
visibility: "hospital_internal"
---

# Reviewer Decision: Task #{task_id}

- **Reviewer**: {reviewer_name}
- **Hospital ID**: {hospital_id}
- **Patient ID**: {patient_id}
- **Related Rules**: [[Safety Rules]], [[Instruction Glossary]]

## Original Clinical Instruction
> {original_text}

## Approved / Corrected Plain Text Explanation
> {corrected_text}

## Clinical Decision & Rationale
{decision_reason}

---
*This decision is recorded in CareBridge Second Brain for future agent RAG retrieval and learning.*
"""

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    wikilinks = extract_wikilinks(md_content)
    embedding_vector = generate_simple_embedding(md_content)

    node = SecondBrainNode(
        path=rel_path,
        title=f"Reviewer Decision for Task #{task_id}",
        category="reviewer-decisions",
        content=md_content,
        wikilinks=wikilinks,
        hospital_id=hospital_id,
        patient_id=patient_id,
        visibility="hospital_internal",
        embedding_json=embedding_vector
    )
    db.add(node)
    
    # Audit log entry
    audit = AuditLog(
        user_role="hospital_reviewer",
        action="WRITE_SECOND_BRAIN_NOTE",
        entity_type="SecondBrainNode",
        entity_id=rel_path,
        details=f"Reviewer {reviewer_name} created decision note for Task #{task_id}"
    )
    db.add(audit)
    db.commit()
    db.refresh(node)

    return node

def sanitize_patient_snippet(text: str) -> str:
    cleaned = re.sub(r'#+\s*Reviewer Decision.*?\n', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'-\s*\*\*Reviewer\*\*.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'-\s*\*\*Hospital ID\*\*.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'-\s*\*\*Patient ID\*\*.*?\n', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'HOS-\d+', '[Hospital]', cleaned)
    cleaned = re.sub(r'Task\s*#?\d+', '', cleaned)
    cleaned = re.sub(r'Patient\s*ID\s*:?\s*\d+', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Dr\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+', 'Care Team Member', cleaned)
    return cleaned.strip()

def query_second_brain_rag(
    db: Session,
    query_text: str,
    hospital_id: str = None,
    patient_id: int = None,
    limit: int = 4,
    is_patient_call: bool = True
) -> List[Dict[str, Any]]:
    """RAG vector / keyword retrieval over Second Brain nodes scoped by hospital and patient visibility."""
    query_vec = generate_simple_embedding(query_text)
    keywords = [w.lower() for w in re.findall(r'\w+', query_text) if len(w) > 3]

    nodes = db.query(SecondBrainNode).all()
    results = []

    for node in nodes:
        node_cat = (node.category or "").lower()
        node_path = (node.path or "").lower()
        node_vis = (node.visibility or "").lower()

        # STRICT PRIVACY RULE FOR PATIENTS: Never retrieve reviewer-decisions, cases, or notes with staff/hospital/patient/task IDs
        if is_patient_call:
            norm_path = node_path.lstrip("/")
            if norm_path.startswith("reviewer-decisions") or norm_path.startswith("cases") or "reviewer-decisions" in node_path or "cases/" in node_path:
                continue
            if node_cat in ["reviewer-decisions", "cases", "internal-rules"]:
                continue
            if node_vis in ["hospital_internal", "admin_only"]:
                continue

            content_lower = (node.content or "").lower()
            title_lower = (node.title or "").lower()
            if any(term in content_lower or term in title_lower for term in ["hos-", "patient id", "patient_id", "task #", "task_id", "reviewer", "staff", "dr. sarah"]):
                continue

            if node.patient_id and node.patient_id != patient_id:
                continue
            if node_cat not in ["instruction-glossary", "patient-friendly-templates", "safety-rules", "public", "general"] and node.patient_id != patient_id:
                continue
        else:
            # Check hospital staff security visibility constraints
            if node_vis == "patient_private" and node.patient_id != patient_id:
                continue
            if node_vis == "hospital_internal" and hospital_id and node.hospital_id and node.hospital_id != hospital_id:
                continue

        # Cosine similarity calculation
        sim = 0.0
        if node.embedding_json:
            import math
            dot = sum(q * n for q, n in zip(query_vec, node.embedding_json))
            sim = dot

        # Keyword bonus
        kw_hits = sum(1 for kw in keywords if kw in node.content.lower() or kw in node.title.lower())
        score = sim + (kw_hits * 0.15)

        # Retrieval confidence threshold: 0.35 for patient calls to prevent low-confidence noise
        min_threshold = 0.35 if is_patient_call else 0.1
        if score >= min_threshold:
            snippet = node.content[:300] + "..."
            if is_patient_call:
                snippet = sanitize_patient_snippet(snippet)

            results.append({
                "node_id": node.id,
                "title": node.title,
                "category": node.category,
                "path": node.path,
                "content_snippet": snippet,
                "wikilinks": node.wikilinks,
                "score": score
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]
