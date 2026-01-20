import sys
from pathlib import Path
from sqlalchemy import text
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.configs.database import SessionLocal

def fix_sequence():
    """
    Reset the sequence for dim_site.site_key to the maximum value in the table.
    This fixes the 'duplicate key value violates unique constraint' error.
    """
    print("Attempting to fix dim_site sequence...")
    with SessionLocal() as session:
        try:
            # 1. Try to get the sequence name dynamically and reset it
            # setval(seq, max + 1, false) -> next nextval will return max + 1
            # But usually we want setval(seq, max, true) -> next nextval will be max+1 ?
            # actually setval(seq, val, is_called=true) sets the current value to 'val', so next is val+1.
            # setval(seq, val, is_called=false) sets the current value to 'val', so next is val.
            
            # Let's use the standard approach: set to max(id)
            sql = text("SELECT setval(pg_get_serial_sequence('dim_site', 'site_key'), (SELECT MAX(site_key) FROM dim_site));")
            session.exec(sql)
            session.commit()
            print("Successfully reset sequence using pg_get_serial_sequence.")
            
        except Exception as e:
            print(f"Primary method failed: {e}")
            session.rollback()
            
            try:
                # 2. Fallback to assuming default sequence name: dim_site_site_key_seq
                print("Trying fallback with default sequence name 'dim_site_site_key_seq'...")
                sql = text("SELECT setval('dim_site_site_key_seq', (SELECT MAX(site_key) FROM dim_site));")
                session.exec(sql)
                session.commit()
                print("Successfully reset sequence using fallback name.")
            except Exception as e2:
                print(f"Fallback failed: {e2}")
                print("\nPlease manually run: SELECT setval('dim_site_site_key_seq', (SELECT MAX(site_key) FROM dim_site));")

if __name__ == "__main__":
    load_dotenv()
    fix_sequence()
