import urllib3
from dotenv import load_dotenv

import averages
import calibrate
from config import configuration, JobType

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()


def main():
    if configuration.JOB_TYPE == JobType.CALIBRATE:
        calibrate.main()

    if configuration.JOB_TYPE == JobType.DAILY_AVERAGES:
        averages.main()


if __name__ == '__main__':
    main()
