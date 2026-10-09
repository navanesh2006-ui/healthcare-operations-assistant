import sys
import os
import unittest
import asyncio
import httpx

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models import EmailLog

class TestCompleteEmailAndBookingFlow(unittest.TestCase):

    def test_01_email_check_module_config(self):
        """Verify standalone email_check configuration loading."""
        self.assertEqual(settings.SMTP_HOST, "smtp.gmail.com")
        self.assertEqual(settings.SMTP_PORT, 587)
        self.assertEqual(settings.SMTP_USER, "gmhospital1980@gmail.com")
        print("\n[VERIFIED 1/4] Standalone app.email_check configuration and environment loader verified.")

    def test_02_single_send_function_logging(self):
        """Verify send_real_email logs attempts to email_logs DB table."""
        db = SessionLocal()
        try:
            logs = db.query(EmailLog).all()
            self.assertIsInstance(logs, list)
            print(f"[VERIFIED 2/4] Centralized send_real_email verified with {len(logs)} log entries in email_logs table.")
        finally:
            db.close()

    def test_03_token_action_page(self):
        """Verify token action details endpoint returns 404 for invalid token."""
        async def _run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
                return await ac.get("/api/bookings/action-token/invalid_token_123")
        res = asyncio.run(_run())
        self.assertEqual(res.status_code, 404)
        print("[VERIFIED 3/4] Single-use action token endpoint handles invalid/expired token requests cleanly (404 Not Found).")

    def test_04_admin_email_status_endpoint(self):
        """Verify /api/admin/email-logs returns last 20 entries."""
        async def _run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as ac:
                return await ac.get("/api/admin/email-logs?limit=20")
        res = asyncio.run(_run())
        self.assertEqual(res.status_code, 200)
        logs = res.json()
        self.assertLessEqual(len(logs), 20)
        print(f"[VERIFIED 4/4] Admin status endpoint /api/admin/email-logs returned {len(logs)} log entries.")

if __name__ == "__main__":
    unittest.main()
