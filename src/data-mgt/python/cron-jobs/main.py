import urllib3
from dotenv import load_dotenv

import calibrate
from config import configuration, JobType

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()


def main():
    if configuration.JOB_TYPE == JobType.CALIBRATE:
        calibrate.main()


if __name__ == '__main__':
    main()
