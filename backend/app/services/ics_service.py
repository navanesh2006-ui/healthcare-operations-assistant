import datetime

def generate_appointment_ics(
    summary: str,
    description: str,
    hospital_name: str,
    address: str,
    start_dt: datetime.datetime,
    duration_minutes: int = 30
) -> str:
    """Generates an iCalendar (.ics) format string for appointment calendar insertion."""
    end_dt = start_dt + datetime.timedelta(minutes=duration_minutes)
    
    dtstamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    dtstart = start_dt.strftime("%Y%m%dT%H%M%SZ")
    dtend = end_dt.strftime("%Y%m%dT%H%M%SZ")
    
    uid = f"carebridge-appt-{int(start_dt.timestamp())}@carebridge.test"

    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CareBridge Agentic Hospital Coordinator//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{dtstamp}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{summary}
DESCRIPTION:{description}
LOCATION:{hospital_name}, {address}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""
    return ics_content
