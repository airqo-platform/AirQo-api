from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import SessionLocal
from app.models import User
import os
import dotenv

dotenv.load_dotenv()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_super_admin():
    email = os.getenv("SUPERADMIN_EMAIL")
    password = os.getenv("SUPERADMIN_PASSWORD")
    if not (email and password):
        raise ValueError("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set")

    with SessionLocal() as db:  # Proper session management
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print("✅ Super Admin already exists.")
            return

        super_admin = User(
            email=email,
            first_name="Trevor",
            last_name="Kasasa",
            password_hash=pwd_context.hash(password),
            role="superadmin",  
            status="active"
        )
        db.add(super_admin)
        db.commit()
        print("🎉 Super Admin created successfully!")
