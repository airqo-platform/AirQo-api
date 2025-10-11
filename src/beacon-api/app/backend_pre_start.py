import logging
from tenacity import after_log, before_log, retry, stop_after_attempt, wait_fixed
from sqlalchemy import text
from app.configs.database import SessionLocal
from app.configs.settings import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

max_tries = 60 * 5
wait_seconds = 1


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARNING),
)
def init() -> None:
    try:
        # Ensure session/connection is always released, even on exceptions.
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        logger.info("Database is ready!")
    except Exception:
        logger.exception("Database readiness check failed")
        raise


def main() -> None:
    logger.info("Initializing service")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info("Waiting for database to be ready...")
    init()
    
    logger.info("Service finished initializing")


if __name__ == "__main__":
    main()