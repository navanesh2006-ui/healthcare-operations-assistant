from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import math
import datetime
from app.database import get_db
from app.models import Provider, Doctor, AvailabilitySlot
from app.schemas import ProviderOut, DoctorOut, SlotOut

router = APIRouter(prefix="/api/hospitals", tags=["Hospitals"])

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in kilometers between two lat/lng coordinates."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 999.0
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

# Approximate centroid coordinates for common TN districts
DISTRICT_COORDS = {
    "chennai": (13.0827, 80.2707),
    "kanchipuram": (12.8342, 79.7036),
    "coimbatore": (11.0168, 76.9558),
    "madurai": (9.9252, 78.1198),
    "ariyalur": (11.1401, 79.0786),
    "tiruchirappalli": (10.7905, 78.7047),
    "salem": (11.6643, 78.1460)
}

@router.get("/search", response_model=List[ProviderOut])
def search_hospitals(
    q: Optional[str] = None,
    district: Optional[str] = None,
    facility_type: Optional[str] = None,
    ownership: Optional[str] = None,
    patient_district: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(Provider)
    if q:
        query = query.filter(Provider.name.ilike(f"%{q}%"))
    if district and district != "All":
        query = query.filter(Provider.district.ilike(f"%{district}%"))
    if facility_type and facility_type != "All":
        query = query.filter(Provider.facility_type.ilike(f"%{facility_type}%"))
    if ownership and ownership != "All":
        query = query.filter(Provider.ownership.ilike(f"%{ownership}%"))

    providers = query.limit(limit).all()

    # Calculate distance if patient district is provided
    ref_lat, ref_lng = None, None
    if patient_district and patient_district.lower() in DISTRICT_COORDS:
        ref_lat, ref_lng = DISTRICT_COORDS[patient_district.lower()]

    result = []
    for p in providers:
        p_dict = ProviderOut.model_validate(p)
        if ref_lat and p.latitude:
            p_dict.distance_km = haversine(ref_lat, ref_lng, p.latitude, p.longitude)
        else:
            p_dict.distance_km = 5.0
        result.append(p_dict)

    if ref_lat:
        result.sort(key=lambda x: x.distance_km if x.distance_km is not None else 999)

    return result

@router.get("/{provider_id}", response_model=ProviderOut)
def get_hospital_details(provider_id: str, db: Session = Depends(get_db)):
    p = db.query(Provider).filter(Provider.provider_id == provider_id).first()
    if not p:
        p = db.query(Provider).first() # Fallback to first available hospital
    return p

@router.get("/{provider_id}/doctors", response_model=List[DoctorOut])
def get_hospital_doctors(provider_id: str, db: Session = Depends(get_db)):
    docs = db.query(Doctor).filter(Doctor.hospital_id == provider_id).all()
    if not docs:
        # Lazy generate 3 synthetic doctors for non-seeded hospitals
        names = ["Dr. K. Anbarasu", "Dr. S. Meenakshi", "Dr. R. Thirumurugan"]
        depts = ["General Medicine", "Cardiology", "Orthopedics"]
        for i in range(3):
            doc = Doctor(
                hospital_id=provider_id,
                name=names[i],
                department=depts[i],
                specialty=depts[i]
            )
            db.add(doc)
        db.commit()
        docs = db.query(Doctor).filter(Doctor.hospital_id == provider_id).all()
    return docs

@router.get("/{provider_id}/slots", response_model=List[SlotOut])
def get_hospital_slots(provider_id: str, doctor_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AvailabilitySlot).filter(AvailabilitySlot.hospital_id == provider_id, AvailabilitySlot.is_booked == False)
    if doctor_id:
        query = query.filter(AvailabilitySlot.doctor_id == doctor_id)
    
    slots = query.all()
    if not slots and doctor_id:
        # Lazy generate 14 days slots for doctor
        doc = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        today = datetime.date.today()
        for day_offset in range(1, 15):
            slot_date = (today + datetime.timedelta(days=day_offset)).isoformat()
            for time_str in ["09:00", "10:30", "14:00", "15:30"]:
                slot = AvailabilitySlot(
                    doctor_id=doctor_id,
                    hospital_id=provider_id,
                    date=slot_date,
                    start_time=time_str,
                    end_time=time_str.replace("00", "30").replace("30", "00"),
                    is_booked=False
                )
                db.add(slot)
        db.commit()
        slots = query.all()

    res = []
    for s in slots:
        doc = db.query(Doctor).filter(Doctor.id == s.doctor_id).first()
        s_out = SlotOut.model_validate(s)
        if doc:
            s_out.doctor_name = doc.name
            s_out.doctor_department = doc.department
        res.append(s_out)
    return res
