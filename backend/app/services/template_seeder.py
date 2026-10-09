import logging
from sqlalchemy.orm import Session
from app.models import ChartTemplate

logger = logging.getLogger("template_seeder")

SEED_TEMPLATES = [
    {
        "name": "Cardiac surgery follow-up",
        "problem_tags": ["Cardiac", "Heart", "Post-Op", "Surgery"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Cardiac Red-Flag Symptoms",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "Report chest pain, shortness of breath, sudden weight gain (>2 kg in 2 days), or fever > 101°F immediately.",
                "needs_review": False
            },
            {
                "type": "Medicine instruction",
                "title": "Anti-platelet & Statin Regimen",
                "relative_days": 1,
                "category": "medicine",
                "instructions": "Take prescribed anti-platelet and statin therapy daily after meals. Do not skip doses.",
                "needs_review": True
            },
            {
                "type": "Care instruction",
                "title": "Wound Care & Suture Inspection",
                "relative_days": 3,
                "category": "care_instruction",
                "instructions": "Inspect sternal incision daily for redness, swelling, or drainage. Keep incision clean and dry.",
                "needs_review": False
            },
            {
                "type": "Check-up / Appointment",
                "title": "First Post-Op Cardiology Visit",
                "relative_days": 7,
                "category": "appointment",
                "department": "Cardiology",
                "instructions": "Outpatient consultation with cardiologist for physical exam and medication review.",
                "needs_review": False
            },
            {
                "type": "Scan or Imaging",
                "title": "Chest X-Ray & ECG Scan",
                "relative_days": 14,
                "category": "scan",
                "department": "Radiology",
                "instructions": "Follow-up Chest X-Ray (PA view) and 12-lead ECG prior to doctor consult.",
                "needs_review": False
            },
            {
                "type": "Lab Test",
                "title": "INR & Lipid Profile Lab Test",
                "relative_days": 15,
                "category": "test",
                "department": "Pathology",
                "instructions": "Fasting blood draw for Lipid profile and PT/INR monitoring.",
                "needs_review": False
            }
        ]
    },
    {
        "name": "Diabetes follow-up",
        "problem_tags": ["Diabetes", "Endocrinology", "Glycemic Control"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Hypoglycemia Warning Signs",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "If experiencing dizziness, sweating, shaking, or confusion, consume 15g fast-acting sugar immediately.",
                "needs_review": False
            },
            {
                "type": "Care instruction",
                "title": "Daily Foot Inspection & Diabetic Diet",
                "relative_days": 1,
                "category": "care_instruction",
                "instructions": "Inspect feet daily for cuts or blisters. Follow low-glycemic, high-fiber meal plan.",
                "needs_review": False
            },
            {
                "type": "Medicine instruction",
                "title": "Insulin / Metformin Dosing Schedule",
                "relative_days": 2,
                "category": "medicine",
                "instructions": "Administer prescribed insulin/metformin according to target blood sugar readings.",
                "needs_review": True
            },
            {
                "type": "Lab Test",
                "title": "Fasting & Post-Prandial Blood Sugar Check",
                "relative_days": 7,
                "category": "test",
                "department": "Biochemistry",
                "instructions": "Measure Fasting Blood Sugar (FBS) and 2-hour Post-Prandial Blood Sugar (PPBS).",
                "needs_review": False
            },
            {
                "type": "Check-up / Appointment",
                "title": "Endocrinologist Consultation",
                "relative_days": 14,
                "category": "appointment",
                "department": "Endocrinology",
                "instructions": "Review glucose logbook and adjust oral anti-diabetic medication / insulin dosage.",
                "needs_review": False
            },
            {
                "type": "Lab Test",
                "title": "HbA1c Glycated Hemoglobin Test",
                "relative_days": 30,
                "category": "test",
                "department": "Biochemistry",
                "instructions": "Quarterly HbA1c test to evaluate overall 3-month glycemic control.",
                "needs_review": False
            }
        ]
    },
    {
        "name": "Fracture / orthopaedic follow-up",
        "problem_tags": ["Fracture", "Orthopaedics", "Bone", "Cast Care"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Compartment Syndrome Warning",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "Report severe unyielding pain, numbness, bluish skin, or pale cold toes immediately.",
                "needs_review": False
            },
            {
                "type": "Care instruction",
                "title": "Limb Elevation & Swelling Management",
                "relative_days": 1,
                "category": "care_instruction",
                "instructions": "Elevate affected limb above heart level when resting. Keep cast completely dry.",
                "needs_review": False
            },
            {
                "type": "Check-up / Appointment",
                "title": "Cast / Dressing Integrity Assessment",
                "relative_days": 7,
                "category": "appointment",
                "department": "Orthopaedics",
                "instructions": "Examine cast tightness, alignment, skin condition, and peripheral circulation.",
                "needs_review": False
            },
            {
                "type": "Scan or Imaging",
                "title": "Orthopaedic Follow-up X-Ray",
                "relative_days": 14,
                "category": "scan",
                "department": "Radiology",
                "instructions": "Digital Radiography X-ray to confirm callus formation and bone fracture alignment.",
                "needs_review": False
            },
            {
                "type": "Referral",
                "title": "Physiotherapy & Rehabilitation",
                "relative_days": 21,
                "category": "referral",
                "department": "Physiotherapy",
                "instructions": "Initiate progressive weight-bearing exercises and joint range-of-motion therapy.",
                "needs_review": False
            }
        ]
    },
    {
        "name": "Post-operative wound care",
        "problem_tags": ["Post-Op", "Wound Care", "Surgical"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Wound Infection Warning Signs",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "Contact surgical team if wound exhibits foul odor, purulent discharge, increasing redness, or fever.",
                "needs_review": False
            },
            {
                "type": "Care instruction",
                "title": "Sterile Dressing Change",
                "relative_days": 1,
                "category": "care_instruction",
                "instructions": "Clean surgical site with sterile saline and apply fresh non-stick dressing.",
                "needs_review": False
            },
            {
                "type": "Medicine instruction",
                "title": "Antibiotic & Analgesic Course",
                "relative_days": 2,
                "category": "medicine",
                "instructions": "Complete full prescribed antibiotic course. Take oral analgesics as needed for pain.",
                "needs_review": True
            },
            {
                "type": "Check-up / Appointment",
                "title": "Suture / Staple Removal Visit",
                "relative_days": 7,
                "category": "appointment",
                "department": "General Surgery",
                "instructions": "Removal of skin sutures or staples and clinical evaluation of wound healing.",
                "needs_review": False
            }
        ]
    },
    {
        "name": "Pregnancy / maternity follow-up",
        "problem_tags": ["Maternity", "Obstetrics", "Postpartum", "Newborn"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Postpartum Red-Flag Symptoms",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "Seek emergency care for heavy vaginal bleeding (soaking >1 pad/hour), severe headache, or fever.",
                "needs_review": False
            },
            {
                "type": "Medicine instruction",
                "title": "Postpartum Iron & Calcium Supplementation",
                "relative_days": 1,
                "category": "medicine",
                "instructions": "Continue oral iron and calcium supplements daily for 3 months post-delivery.",
                "needs_review": True
            },
            {
                "type": "Check-up / Appointment",
                "title": "Postnatal Maternal & Newborn Visit",
                "relative_days": 7,
                "category": "appointment",
                "department": "Obstetrics & Gynecology",
                "instructions": "Comprehensive checkup for mother (uterine involution, lochia) and newborn weight/jaundice.",
                "needs_review": False
            },
            {
                "type": "Lab Test",
                "title": "Maternal Complete Blood Count (CBC)",
                "relative_days": 14,
                "category": "test",
                "department": "Pathology",
                "instructions": "Check hemoglobin levels and screen for postpartum anemia.",
                "needs_review": False
            },
            {
                "type": "Referral",
                "title": "Lactation & Postpartum Counseling",
                "relative_days": 30,
                "category": "referral",
                "department": "Pediatrics / Counseling",
                "instructions": "Lactation support consultation and screening for postpartum emotional wellness.",
                "needs_review": False
            }
        ]
    },
    {
        "name": "Fever / infection recovery",
        "problem_tags": ["Infection", "Fever", "General Medicine"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Infection Warning Signs",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "Return immediately if body temperature exceeds 102°F, or if developing shortness of breath.",
                "needs_review": False
            },
            {
                "type": "Care instruction",
                "title": "Hydration & Rest Protocol",
                "relative_days": 1,
                "category": "care_instruction",
                "instructions": "Maintain oral fluid intake > 2.5 L daily. Record body temperature twice daily.",
                "needs_review": False
            },
            {
                "type": "Medicine instruction",
                "title": "Targeted Antimicrobial Therapy",
                "relative_days": 2,
                "category": "medicine",
                "instructions": "Finish exact prescribed antibiotic/antiviral regimen without skipping doses.",
                "needs_review": True
            },
            {
                "type": "Check-up / Appointment",
                "title": "Fever Recovery & Clinical Re-evaluation",
                "relative_days": 4,
                "category": "appointment",
                "department": "General Medicine",
                "instructions": "Evaluate fever resolution, hydration status, and vitals.",
                "needs_review": False
            },
            {
                "type": "Lab Test",
                "title": "Follow-up Complete Blood Count (CBC)",
                "relative_days": 7,
                "category": "test",
                "department": "Pathology",
                "instructions": "Repeat CBC to verify normalization of white blood cell count and platelets.",
                "needs_review": False
            }
        ]
    },
    {
        "name": "Kidney care follow-up",
        "problem_tags": ["Nephrology", "Kidney", "Renal"],
        "disclaimer": "Sample template, hospital must confirm clinical content.",
        "steps": [
            {
                "type": "Warning signs",
                "title": "Renal Failure Red Flags",
                "relative_days": 0,
                "category": "warning_sign",
                "instructions": "Report sudden decrease in urine output (oliguria), facial or pedal swelling, or nausea.",
                "needs_review": False
            },
            {
                "type": "Care instruction",
                "title": "Renal Diet & Fluid Restriction Protocol",
                "relative_days": 1,
                "category": "care_instruction",
                "instructions": "Adhere strictly to low-sodium (<2g/day), low-potassium diet, and fluid restriction as advised.",
                "needs_review": False
            },
            {
                "type": "Lab Test",
                "title": "Serum Creatinine & Electrolytes Test",
                "relative_days": 7,
                "category": "test",
                "department": "Biochemistry",
                "instructions": "Blood test for Serum Creatinine, Blood Urea Nitrogen (BUN), Na+, K+, and eGFR.",
                "needs_review": False
            },
            {
                "type": "Check-up / Appointment",
                "title": "Nephrology Specialist Consultation",
                "relative_days": 14,
                "category": "appointment",
                "department": "Nephrology",
                "instructions": "Review renal function panel, blood pressure log, and medication tolerance.",
                "needs_review": False
            },
            {
                "type": "Lab Test",
                "title": "24-Hour Urine Protein Quantification",
                "relative_days": 30,
                "category": "test",
                "department": "Biochemistry",
                "instructions": "24-hour urine collection for total protein and albuminuria evaluation.",
                "needs_review": False
            }
        ]
    }
]

def seed_chart_templates(db: Session):
    existing_count = db.query(ChartTemplate).filter(ChartTemplate.hospital_id == None).count()
    if existing_count == 0:
        logger.info("Seeding synthetic chart templates...")
        for t_data in SEED_TEMPLATES:
            t = ChartTemplate(
                hospital_id=None,
                name=t_data["name"],
                problem_tags=t_data["problem_tags"],
                steps=t_data["steps"],
                is_sample=True,
                disclaimer=t_data["disclaimer"]
            )
            db.add(t)
        db.commit()
        logger.info(f"Seeded {len(SEED_TEMPLATES)} chart templates successfully.")
    else:
        # Update existing sample templates to ensure updated relative_days offsets
        for t_data in SEED_TEMPLATES:
            t = db.query(ChartTemplate).filter(ChartTemplate.hospital_id == None, ChartTemplate.name == t_data["name"]).first()
            if t:
                t.steps = t_data["steps"]
        db.commit()
