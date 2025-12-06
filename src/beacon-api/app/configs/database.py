from typing import Generator
from sqlmodel import Session, create_engine, SQLModel
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from .settings import settings
import logging
import os

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session,
    expire_on_commit=False
)


def run_migrations() -> None:
    """
    Executes the migrations001.sql script to ensure database schema is up to date.
    """
    try:
        # Calculate path to migrations001.sql relative to this file
        # app/configs/database.py -> app/configs -> app -> src/beacon-api
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        migration_path = os.path.join(base_dir, "postgres", "migrations", "migrations001.sql")
        
        if not os.path.exists(migration_path):
            logger.warning(f"Migration file not found at {migration_path}")
            return

        logger.info(f"Running migrations from {migration_path}")
        
        with open(migration_path, "r") as f:
            sql_script = f.read()
        
        with engine.connect() as conn:
            # Set isolation level to AUTOCOMMIT to allow operations like ALTER DATABASE
            conn = conn.execution_options(isolation_level="AUTOCOMMIT")
            
            # Use raw cursor to execute script directly, avoiding SQLAlchemy's parameter binding
            # which can misinterpret PL/pgSQL assignments (:=) as bind parameters
            with conn.connection.cursor() as cursor:
                cursor.execute(sql_script)
                
        logger.info("Migrations completed successfully")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        # We log the error but allow the app to continue, as some errors (like permission issues)
        # might be expected in certain environments, or the DB might already be in a good state.
        # However, for critical schema missing, the app will likely fail later.


def init_db() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection established successfully")
        # Run migrations on startup
        run_migrations()
    except Exception as e:
        logger.error(f"Error connecting to database: {e}")
        raise


def get_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session