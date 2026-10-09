import sys
import argparse
import logging
from app.database import SessionLocal
from app.services.seed import (
    seed_providers_only, seed_demo_accounts, cleanup_demo_data, reset_database
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("app.seed")

def main():
    parser = argparse.ArgumentParser(description="CareBridge Database Seeding & Maintenance CLI")
    parser.add_argument("--demo-accounts", action="store_true", help="Seed optional demo accounts (staff@hospital-a.demo, etc.)")
    parser.add_argument("--cleanup-demo", action="store_true", help="Delete all demo/fake user accounts and sample data")
    parser.add_argument("--reset", action="store_true", help="Completely drop and recreate all database tables")
    parser.add_argument("--force", action="store_true", help="Bypass interactive prompt for --reset")

    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.reset:
            reset_database(db, force=args.force)
        elif args.cleanup_demo:
            cleanup_demo_data(db)
        elif args.demo_accounts:
            seed_demo_accounts(db)
        else:
            seed_providers_only(db)
    finally:
        db.close()

if __name__ == "__main__":
    main()
