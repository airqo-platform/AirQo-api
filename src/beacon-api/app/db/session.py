from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

_connect_args = {"check_same_thread": False} if "sqlite" in settings.SQLALCHEMY_DATABASE_URI else {}

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args=_connect_args,
    pool_pre_ping=True,       # test connections before checkout (detects stale/dead connections)
    pool_recycle=300,          # recycle connections every 5 min to avoid server-side timeouts
    pool_size=5,
    max_overflow=10,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
