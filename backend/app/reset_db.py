import sys
import argparse
import logging
from app.database import SessionLocal
from app.services.seed import reset_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

def main():
    parser = argparse.ArgumentParser(description="CareBridge Database Reset CLI")
    parser.add_argument("--force", action="store_true", help="Bypass interactive confirmation prompt")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        reset_database(db, force=args.force)
    finally:
        db.close()

if __name__ == "__main__":
    main()
