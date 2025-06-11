# superAdmin.py

from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import SessionLocal
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def create_super_admin():
    db: Session = SessionLocal()
    email = "kasasatrevor25@gmail.com"
    password = "Admin@2001"

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        print("✅ Super Admin already exists.")
        return

    super_admin = User(
        email=email,
        first_name="Trevor",
        last_name="Kasasa",
        password_hash=pwd_context.hash(password),
        role="superadmin",  # This ensures the user is a Super Admin
        status="active"
    )
    db.add(super_admin)
    db.commit()
    db.close()
    print("🎉 Super Admin created successfully!")
