from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import SecondBrainNode
from app.schemas import SecondBrainNodeOut
from app.security import get_current_user_data
from app.services.second_brain import sync_second_brain_files_to_db

router = APIRouter(prefix="/api/second-brain", tags=["SecondBrain"])

@router.get("/nodes", response_model=List[SecondBrainNodeOut])
def get_second_brain_nodes(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user_data),
    db: Session = Depends(get_db)
):
    query = db.query(SecondBrainNode)
    if category and category != "All":
        query = query.filter(SecondBrainNode.category == category)
    
    nodes = query.all()
    filtered = []
    for n in nodes:
        if n.visibility == "patient_private" and current_user["role"] == "patient" and n.patient_id != current_user["patient_id"]:
            continue
        filtered.append(n)
    return filtered

@router.get("/nodes/{node_id}", response_model=SecondBrainNodeOut)
def get_node_by_id(node_id: int, db: Session = Depends(get_db)):
    node = db.query(SecondBrainNode).filter(SecondBrainNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.post("/resync")
def resync_vault(db: Session = Depends(get_db)):
    count = sync_second_brain_files_to_db(db)
    return {"message": f"Successfully resynced {count} Second Brain markdown vault notes into database vector store."}
