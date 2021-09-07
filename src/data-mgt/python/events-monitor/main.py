import os

from dotenv import load_dotenv

from EventsCheck import EventsCheck

load_dotenv()

if __name__ == '__main__':

    AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL")
    SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")
    AIRQO_HOURS = os.getenv("AIRQO_HOURS")
    KCCA_HOURS = os.getenv("KCCA_HOURS")
    MINUTES = os.getenv("MINUTES")

    events_check = EventsCheck(AIRQO_BASE_URL, SLACK_WEBHOOK)
    events_check.run_check(tenant="airqo", hours=AIRQO_HOURS, minutes=MINUTES)
    events_check.run_check(tenant="kcca", hours=KCCA_HOURS, minutes=MINUTES)
