# app/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

def get_database_url():
    """Get database URL from environment"""
    return os.getenv(
        "DATABASE_URL", 
        "postgresql://airqo_user:airqo_password@localhost:5432/airqo_db"
    )

# Create database engine
engine = create_engine(get_database_url())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Database dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()