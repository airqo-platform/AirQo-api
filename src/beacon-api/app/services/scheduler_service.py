import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.thingspeak_sync_service import sync_device_data
from app.core.config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

async def scheduled_thingspeak_sync():
    logger.info("Starting scheduled ThingSpeak data sync...")
    try:
        # Runs the sync orchestrator (default 14 days lookback, but will skip days already synced)
        summary = await sync_device_data()
        logger.info(f"Scheduled ThingSpeak data sync completed: {summary}")
    except Exception as e:
        logger.exception(f"Error during scheduled ThingSpeak data sync: {e}")

def start_scheduler():
    if not getattr(settings, "SCHEDULER_ENABLED", True):
        logger.info("Scheduler is disabled in settings.")
        return

    logger.info("Starting background scheduler...")
    
    # Run the ThingSpeak sync every day at 23:00
    scheduler.add_job(
        scheduled_thingspeak_sync,
        'cron',
        hour=22,
        minute=0,
        id='thingspeak_daily_sync',
        replace_existing=True
    )
    
    scheduler.start()

def stop_scheduler():
    if scheduler.running:
        logger.info("Stopping background scheduler...")
        scheduler.shutdown(wait=False)
