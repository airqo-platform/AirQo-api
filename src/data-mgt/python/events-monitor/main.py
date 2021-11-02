import os

from dotenv import load_dotenv

from events import Events

load_dotenv()

if __name__ == '__main__':

    BASE_URL = os.getenv("AIRQO_BASE_URL")
    SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")

    if BASE_URL is None or SLACK_WEBHOOK is None:
        raise Exception('missing configurations')

    airqo = Events(BASE_URL, SLACK_WEBHOOK, 'airqo')

    if airqo.check_api():
        airqo.check_measurements(hours=1, frequency='raw')
        airqo.check_measurements(hours=3, frequency='hourly')

    kcca = Events(BASE_URL, SLACK_WEBHOOK, 'kcca')

    if kcca.check_api():
        kcca.check_measurements(hours=1, frequency='raw')
        kcca.check_measurements(hours=3, frequency='hourly')

