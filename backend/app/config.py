import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Load .env file from root or backend directory if present
try:
    from dotenv import load_dotenv
    root_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if root_env.exists():
        load_dotenv(dotenv_path=root_env, override=True)
    else:
        load_dotenv(override=True)
except Exception:
    pass

def _clean_str(val: str) -> str:
    if not val:
        return ""
    return str(val).strip().strip("'\"").strip()

class Settings(BaseSettings):
    PROJECT_NAME: str = "CareBridge: Agentic Hospital Discharge & Follow-up Coordinator"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "carebridge_secret_key_for_hackforge_code_a_thon_2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database configuration (Defaults to SQLite for local fallback, PostgreSQL in Docker)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./carebridge.db")
    
    # LLM Configuration
    LLM_PROVIDER: str = _clean_str(os.getenv("LLM_PROVIDER", "gemini"))
    LLM_MODEL: str = _clean_str(os.getenv("LLM_MODEL", "gemini-2.5-flash"))
    LLM_API_KEY: str = _clean_str(os.getenv("LLM_API_KEY", os.getenv("OPENAI_API_KEY", "")))
    EMBEDDING_MODEL: str = _clean_str(os.getenv("EMBEDDING_MODEL", "text-embedding-004"))
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    USE_REGEX_FALLBACK_IF_NO_KEY: bool = True
    
    # SMTP / Real Email configuration
    SMTP_HOST: str = _clean_str(os.getenv("SMTP_HOST", "smtp.gmail.com"))
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = _clean_str(os.getenv("SMTP_USER", "gmhospital1980@gmail.com"))
    SMTP_PASSWORD: str = _clean_str(os.getenv("SMTP_PASSWORD", ""))
    SMTP_FROM_NAME: str = _clean_str(os.getenv("SMTP_FROM_NAME", "CareBridge"))
    SMTP_FROM: str = os.getenv("SMTP_FROM", "CareBridge <gmhospital1980@gmail.com>")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() in ["true", "1", "yes"]
    
    # Public Base URL for email links
    PUBLIC_BASE_URL: str = _clean_str(os.getenv("PUBLIC_BASE_URL", "http://localhost:3000"))
    HOSPITAL_DEMO_EMAIL: str = _clean_str(os.getenv("HOSPITAL_DEMO_EMAIL", "gmhospital1980@gmail.com"))
    
    # Second brain path
    SECOND_BRAIN_PATH: str = os.getenv("SECOND_BRAIN_PATH", "./second-brain")

    class Config:
        case_sensitive = True

settings = Settings()
