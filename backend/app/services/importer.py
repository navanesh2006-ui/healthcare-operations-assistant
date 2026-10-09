import os
import csv
import logging
from sqlalchemy.orm import Session
from app.models import Provider

logger = logging.getLogger("importer")

def detect_file_and_encoding():
    primary = os.path.join("data", "providers_tn_clean.csv")
    fallback = os.path.join("data", "providers.csv")
    
    file_path = primary if os.path.exists(primary) else fallback
    if not os.path.exists(file_path):
        # Try root level or parent directory lookups
        alt_primary = os.path.join("..", "data", "providers_tn_clean.csv")
        if os.path.exists(alt_primary):
            file_path = alt_primary
        else:
            file_path = os.path.join("..", "data", "providers.csv")

    encodings = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]
    chosen_encoding = "utf-8"
    
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                f.read(4096)
            chosen_encoding = enc
            break
        except UnicodeDecodeError:
            continue
            
    return file_path, chosen_encoding

def import_providers(db: Session) -> int:
    existing_count = db.query(Provider).count()
    if existing_count > 0:
        logger.info(f"Providers table already seeded with {existing_count} rows.")
        return existing_count

    file_path, encoding = detect_file_and_encoding()
    logger.info(f"Importing providers from {file_path} with encoding {encoding}...")
    
    if not os.path.exists(file_path):
        logger.warning(f"No provider dataset found at {file_path}")
        return 0

    imported = 0
    with open(file_path, "r", encoding=encoding, errors="replace") as f:
        reader = csv.DictReader(f)
        batch = []
        for i, row in enumerate(reader):
            pid = row.get("provider_id") or f"TN{23721+i}"
            name = row.get("name") or "Unknown Provider"
            ftype = row.get("facility_type") or "Hospital"
            ownership = row.get("ownership") or "Unspecified"
            sys_med = row.get("systems_of_medicine") or "Unspecified"
            specialties = row.get("specialties") or ""
            addr = row.get("address") or ""
            district = row.get("district") or "Chennai"
            state = row.get("state") or "Tamil Nadu"
            pincode = row.get("pincode") or ""
            phone = row.get("phone") or ""
            email = row.get("public_email") or ""
            website = row.get("website") or ""
            
            lat = None
            try:
                lat = float(row.get("latitude")) if row.get("latitude") else None
            except Exception:
                pass
                
            lng = None
            try:
                lng = float(row.get("longitude")) if row.get("longitude") else None
            except Exception:
                pass

            csource = row.get("coord_source") or "approx_from_district_pincode"
            
            provider = Provider(
                provider_id=pid.strip(),
                name=name.strip(),
                facility_type=ftype.strip(),
                ownership=ownership.strip(),
                systems_of_medicine=sys_med.strip(),
                specialties=specialties.strip(),
                address=addr.strip(),
                district=district.strip(),
                state=state.strip(),
                pincode=pincode.strip(),
                phone=phone.strip(),
                public_email=email.strip(),
                website=website.strip(),
                latitude=lat,
                longitude=lng,
                coord_source=csource
            )
            batch.append(provider)
            
            if len(batch) >= 500:
                db.bulk_save_objects(batch)
                db.commit()
                imported += len(batch)
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            imported += len(batch)

    logger.info(f"Successfully imported {imported} providers into database.")
    return imported
