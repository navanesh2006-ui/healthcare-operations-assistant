import hashlib
import re
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    """SHA256 + secret key salt password hashing."""
    salt = settings.SECRET_KEY[:16]
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < 6:
        return False, "Password must be at least 6 characters long."
    return True, "Strong"

def mask_email(email: str) -> str:
    if "@" not in email:
        return email
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user_data(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("user_id")
        role: str = payload.get("role")
        email: str = payload.get("sub")
        if user_id is None or role is None:
            raise credentials_exception
            
        patient_id = payload.get("patient_id")
        hospital_id = payload.get("hospital_id")
        
        # Fallback to DB query if patient_id or hospital_id is missing from token payload
        if (role == "patient" and patient_id is None) or (role in ["hospital_staff", "hospital_reviewer"] and hospital_id is None):
            from app.models import User
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                patient_id = patient_id if patient_id is not None else user.patient_id
                hospital_id = hospital_id if hospital_id is not None else user.hospital_id

        return {
            "user_id": user_id,
            "role": role,
            "email": email,
            "hospital_id": hospital_id,
            "patient_id": patient_id,
            "name": payload.get("name", "User"),
            "user_code": payload.get("user_code", "")
        }
    except JWTError:
        raise credentials_exception

def require_role(roles: list[str]):
    def role_checker(current_user: dict = Depends(get_current_user_data)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user['role']}' is not authorized. Required: {roles}"
            )
        return current_user
    return role_checker
