import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base, SessionLocal, ensure_schema_up_to_date
from app.api import (
    auth, connections, discharge, tasks, bookings, hospitals,
    patients, chatbot, second_brain, feedback, documents,
    analytics, audit, charts, admin, queries
)
from app.models import Provider
from app.services.importer import import_providers
from app.services.second_brain import sync_second_brain_files_to_db
from app.services.template_seeder import seed_chart_templates

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Create Database tables non-destructively & ensure missing columns are migrated
Base.metadata.create_all(bind=engine)
ensure_schema_up_to_date(engine)

# Auto-seed provider directory & chart templates
db = SessionLocal()
try:
    if db.query(Provider).count() == 0:
        logger.info("Providers table is empty. Auto-importing hospital directory dataset...")
        import_providers(db)
    seed_chart_templates(db)
    sync_second_brain_files_to_db(db)
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="CareBridge: Real Multi-User Agentic Hospital Discharge & Follow-up Coordinator",
    version="2.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded files directory
os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")

# Include API Routers
app.include_router(auth.router)
app.include_router(connections.router)
app.include_router(discharge.router)
app.include_router(tasks.router)
app.include_router(bookings.router)
app.include_router(hospitals.router)
app.include_router(patients.router)
app.include_router(charts.router)
app.include_router(chatbot.router)
app.include_router(second_brain.router)
app.include_router(feedback.router)
app.include_router(documents.router)
app.include_router(analytics.router)
app.include_router(audit.router)
app.include_router(admin.router)
app.include_router(queries.router)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "status": "online",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
