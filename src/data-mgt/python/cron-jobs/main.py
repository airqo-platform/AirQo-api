import os

import urllib3
from dotenv import load_dotenv

from measurements import average_measurements_by_hour

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()


def main():
    hours = int(os.getenv("HOURS", 1))
    average_measurements_by_hour(hours=hours)


if __name__ == '__main__':
    main()
