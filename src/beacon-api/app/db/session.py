from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
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


# Async SQLAlchemy Configuration
async_db_uri = settings.SQLALCHEMY_DATABASE_URI
if async_db_uri.startswith("postgresql://"):
    async_db_uri = async_db_uri.replace("postgresql://", "postgresql+psycopg://", 1)

async_engine = create_async_engine(
    async_db_uri,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_async_db():
    async with AsyncSessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()
