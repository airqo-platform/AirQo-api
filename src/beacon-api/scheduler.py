import logging
import sys
import os
from datetime import datetime, timedelta, timezone

# Add the current directory to python path to allow imports from app
# This assumes the script is run from the project root
sys.path.append(os.getcwd())

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlmodel import select

from app.configs.database import SessionLocal
from app.models.airqloud import AirQloud
from cronjobs.performance_jobs.fetch_thingspeak_data_v2 import EnhancedThingSpeakDataFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def run_daily_airqloud_job():
    """
    Daily job to fetch data and calculate performance for all AirQlouds.
    Fetches data for the last 14 days.
    """
    logger.info("Starting daily AirQloud performance fetch job")
    
    # Calculate date range: last 14 days ending yesterday
    # This matches the logic in the API endpoint
    days = 14
    now = datetime.now(timezone.utc)
    
    # End date is yesterday (end of day)
    end_date = (now - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=999999)
    
    # Start date is 14 days ago (start of day)
    # We subtract days-1 because the range is inclusive of end_date
    start_date = (end_date - timedelta(days=days-1)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    logger.info(f"Date range: {start_date.strftime('%Y-%m-%d %H:%M:%S')} to {end_date.strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        with SessionLocal() as session:
            fetcher = EnhancedThingSpeakDataFetcher(session)
            
            # Get all AirQlouds
            airqlouds = session.exec(select(AirQloud)).all()
            logger.info(f"Found {len(airqlouds)} AirQlouds to process")
            
            for airqloud in airqlouds:
                try:
                    # process_airqloud_with_fetch_log will:
                    # 1. Identify missing data ranges for the airqloud
                    # 2. Fetch missing data for all devices in the airqloud
                    # 3. Calculate airqloud performance
                    # 4. Store everything in the database
                    fetcher.process_airqloud_with_fetch_log(airqloud, start_date, end_date)
                    
                    # Commit after each airqloud to save progress
                    session.commit()
                    
                except Exception as e:
                    logger.error(f"Error processing AirQloud {airqloud.name} ({airqloud.id}): {str(e)}")
                    session.rollback()
                    continue
            
            fetcher.print_summary()
            logger.info("Daily AirQloud performance fetch job completed")
            
    except Exception as e:
        logger.error(f"Fatal error in daily AirQloud job: {str(e)}")

def start_scheduler():
    """Start the blocking scheduler"""
    scheduler = BlockingScheduler()
    
    # Schedule to run at 4:00 AM every day
    # You can adjust the timezone if needed, default is local time
    trigger = CronTrigger(hour=4, minute=0)
    
    scheduler.add_job(
        run_daily_airqloud_job,
        trigger=trigger,
        id='daily_airqloud_fetch',
        name='Daily AirQloud Performance Fetch',
        replace_existing=True
    )
    
    logger.info("Scheduler started. Job scheduled for 04:00 AM daily.")
    logger.info("Press Ctrl+C to exit")
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped")

if __name__ == "__main__":
    start_scheduler()
