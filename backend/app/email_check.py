import sys
import os
import smtplib
import email.utils
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings

def main():
    recipient = sys.argv[1] if len(sys.argv) > 1 else settings.HOSPITAL_DEMO_EMAIL
    print(f"=== CareBridge Standalone Gmail SMTP Diagnostic Tool ===")
    print(f"Target Recipient: {recipient}")
    print(f"SMTP Host: {settings.SMTP_HOST}")
    print(f"SMTP Port: {settings.SMTP_PORT}")
    print(f"SMTP User: '{settings.SMTP_USER}'")
    print(f"SMTP Password Set: {'YES (' + str(len(settings.SMTP_PASSWORD)) + ' chars)' if settings.SMTP_PASSWORD else 'NO (EMPTY)'}")
    print(f"SMTP TLS: {settings.SMTP_USE_TLS}")
    print(f"Public Base URL: {settings.PUBLIC_BASE_URL}")
    print("---------------------------------------------------------")

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[ERROR] Cannot send email: SMTP_USER or SMTP_PASSWORD is missing/empty in .env!")
        print("Please configure SMTP_USER=gmhospital1980@gmail.com and SMTP_PASSWORD=<16-char-app-password> in .env")
        sys.exit(1)

    # Build Message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[CareBridge Diagnostic Test] Live SMTP Check to {recipient}"
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = recipient
    msg["Message-ID"] = email.utils.make_msgid(domain="carebridge.local")
    msg["Date"] = email.utils.formatdate(localtime=True)

    text_body = f"CareBridge SMTP Delivery Verification Test to {recipient}.\nPublic URL: {settings.PUBLIC_BASE_URL}"
    html_body = f"""
    <div style="font-family: sans-serif; background-color: #0B1F22; color: #E6F2E6; padding: 24px; border-radius: 12px;">
        <h2 style="color: #4CAF50; margin-top: 0;">CareBridge SMTP Delivery Check</h2>
        <p>This email confirms that Gmail SMTP delivery is active and functioning correctly.</p>
        <ul>
            <li><strong>Recipient:</strong> {recipient}</li>
            <li><strong>Sender:</strong> {settings.SMTP_USER}</li>
            <li><strong>Host:</strong> {settings.SMTP_HOST}:{settings.SMTP_PORT}</li>
            <li><strong>Public Base URL:</strong> {settings.PUBLIC_BASE_URL}</li>
        </ul>
    </div>
    """
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        print(f"Connecting to SMTP server {settings.SMTP_HOST}:{settings.SMTP_PORT}...")
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        
        server.set_debuglevel(1)
        server.ehlo()
        if settings.SMTP_USE_TLS and settings.SMTP_PORT != 465:
            print("Starting STARTTLS...")
            server.starttls()
            server.ehlo()

        print(f"Authenticating as {settings.SMTP_USER}...")
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        print(f"Sending message to {recipient}...")
        send_res = server.sendmail(settings.SMTP_USER, [recipient], msg.as_string())
        server.quit()

        print("\n=========================================================")
        print(f"[SUCCESS] Email successfully delivered via Gmail SMTP!")
        print(f"SMTP sendmail response: {send_res}")
        print("=========================================================")
    except Exception as e:
        print("\n=========================================================")
        print(f"[SMTP EXCEPTION FAILED] Could not send email via Gmail SMTP:")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Detail: {e}")
        print("=========================================================")
        sys.exit(1)

if __name__ == "__main__":
    main()
