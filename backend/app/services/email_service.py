import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import secrets
import logging
import datetime
import time
import traceback
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.config import settings
from app.models import EmailLog

logger = logging.getLogger("email_service")

def generate_ics_calendar(
    event_title: str,
    description: str,
    start_time: datetime.datetime,
    duration_minutes: int = 45,
    location: str = "Hospital OPD"
) -> str:
    """Generates standard iCalendar (.ics) string for appointment attachment."""
    end_time = start_time + datetime.timedelta(minutes=duration_minutes)
    dtstamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    dtstart = start_time.strftime("%Y%m%dT%H%M%SZ")
    dtend = end_time.strftime("%Y%m%dT%H%M%SZ")
    uid = f"{secrets.token_hex(8)}@carebridge.health"

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CareBridge Healthcare Follow-up Coordinator//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART:{dtstart}",
        f"DTEND:{dtend}",
        f"SUMMARY:{event_title}",
        f"DESCRIPTION:{description.replace('\n', ' ')}",
        f"LOCATION:{location}",
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR"
    ]
    return "\r\n".join(ics_lines)

def wrap_html_template(title: str, content_body: str) -> str:
    """Wraps body in CareBridge green-themed responsive HTML template."""
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #051315; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E6F2E6;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #051315; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B1F22; border: 1px solid #1E4A38; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #12332B; padding: 24px 30px; border-bottom: 2px solid #4CAF50;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; tracking-wide: 1px;">
                                            <span style="color: #4CAF50;">Care</span>Bridge Healthcare
                                        </h1>
                                        <p style="margin: 4px 0 0 0; color: #8BC34A; font-size: 12px; font-weight: 600;">
                                            Agentic Hospital Discharge & Follow-up Coordinator
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Content Body -->
                    <tr>
                        <td style="padding: 30px; line-height: 1.6; font-size: 14px; color: #E6F2E6;">
                            {content_body}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #08181A; padding: 20px 30px; border-top: 1px solid #1E4A38; text-align: center; font-size: 11px; color: #9EBE9E;">
                            <p style="margin: 0 0 6px 0;">This email was dispatched by CareBridge Healthcare Operations Assistant.</p>
                            <p style="margin: 0; font-family: monospace;">Public Base URL: {settings.PUBLIC_BASE_URL}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

import email.utils

def send_real_email(
    db: Session,
    recipient_email: str,
    recipient_name: str,
    subject: str,
    body_html: str,
    email_type: str = "notification",
    plain_text: Optional[str] = None,
    attachments: Optional[List[Tuple[str, bytes, str]]] = None,
    is_hospital_target: bool = False,
    reply_to_email: Optional[str] = None
) -> EmailLog:
    """
    Sends real email via Gmail SMTP (or configured SMTP provider).
    - Hospital-bound emails are routed to settings.HOSPITAL_DEMO_EMAIL (gmhospital1980@gmail.com).
    - Patient-bound emails are sent directly to recipient_email.
    - Adds unique Message-ID and Date headers so Gmail does not de-duplicate threads.
    - Sets Reply-To header to patient email on hospital-bound emails.
    - Saves execution log into email_logs table.
    """
    clean_target = recipient_email.strip().lower()

    # Route hospital-bound emails to HOSPITAL_DEMO_EMAIL
    if is_hospital_target or email_type in ["booking_request", "patient_query", "hospital_admin", "document_uploaded", "feedback_submitted", "request_status_change"]:
        actual_recipient = settings.HOSPITAL_DEMO_EMAIL.strip().lower()
        if not reply_to_email and clean_target != actual_recipient:
            reply_to_email = clean_target
    else:
        actual_recipient = clean_target

    formatted_html = wrap_html_template(subject, body_html)

    # Log entry
    log_entry = EmailLog(
        recipient_email=actual_recipient,
        recipient_name=recipient_name or "",
        subject=subject,
        email_type=email_type,
        status="sending",
        error_message=None
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)

    # Build MIME Message
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    from_name = getattr(settings, 'SMTP_FROM_NAME', 'CareBridge')
    from_email = getattr(settings, 'SMTP_USER', 'gmhospital1980@gmail.com')
    if not from_email:
        from_email = 'gmhospital1980@gmail.com'
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = actual_recipient
    msg["Message-ID"] = email.utils.make_msgid(domain="carebridge.health")
    msg["Date"] = email.utils.formatdate(localtime=True)

    if reply_to_email:
        msg["Reply-To"] = reply_to_email

    alt_part = MIMEMultipart("alternative")
    if plain_text:
        alt_part.attach(MIMEText(plain_text, "plain"))
    else:
        alt_part.attach(MIMEText(subject, "plain"))
    alt_part.attach(MIMEText(formatted_html, "html"))
    msg.attach(alt_part)

    # Process attachments
    if attachments:
        for fname, fbytes, fmime in attachments:
            if "/" in fmime:
                maintype, subtype = fmime.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"
            
            part = MIMEBase(maintype, subtype)
            part.set_payload(fbytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=fname)
            msg.attach(part)

    # Transmit via SMTP with 3 retries and exponential backoff
    host = settings.SMTP_HOST or "smtp.gmail.com"
    port = settings.SMTP_PORT or 587
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    use_tls = settings.SMTP_USE_TLS

    success = False
    last_error = ""

    for attempt in range(1, 4):
        try:
            if not user or not password:
                raise ValueError("SMTP_USER or SMTP_PASSWORD is not configured in .env!")

            if port == 465:
                server = smtplib.SMTP_SSL(host, port, timeout=12)
            else:
                server = smtplib.SMTP(host, port, timeout=12)

            server.ehlo()
            if use_tls and port != 465:
                server.starttls()
                server.ehlo()

            server.login(user, password)
            server.sendmail(user, [actual_recipient], msg.as_string())
            server.quit()

            success = True
            logger.info(f"[Email Success] Sent '{subject}' to {actual_recipient} (type: {email_type})")
            break
        except Exception as e:
            last_error = str(e)
            logger.warning(f"[SMTP Attempt {attempt}/3 Failed] {actual_recipient}: {last_error}")
            time.sleep(attempt * 1.5)

    if success:
        log_entry.status = "sent"
        log_entry.error_message = None
    else:
        log_entry.status = "failed"
        log_entry.error_message = f"SMTP Failure: {last_error}"
        logger.error(f"[Email Delivery Failed] {actual_recipient} (type: {email_type}): {last_error}")

    db.commit()
    db.refresh(log_entry)
    return log_entry
