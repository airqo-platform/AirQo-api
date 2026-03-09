from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

Base = declarative_base()

# Lazy engine creation — avoid connecting at import time,
# which causes Cloud Run to hang if the DB isn't reachable yet.
_engine = None
_SessionLocal = None


def _get_engine():
    global _engine
    if _engine is None:
        uri = settings.SQLALCHEMY_DATABASE_URI
        connect_args = {"check_same_thread": False} if "sqlite" in uri else {}
        _engine = create_engine(uri, connect_args=connect_args, pool_pre_ping=True)
    return _engine


def _get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=_get_engine()
        )
    return _SessionLocal


def get_engine():
    """Get the SQLAlchemy engine (lazy init)."""
    return _get_engine()


def SessionLocal():
    """Create a new DB session (lazy engine init on first call)."""
    factory = _get_session_factory()
    return factory()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
