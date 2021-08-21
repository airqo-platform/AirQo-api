import urllib3
from dotenv import load_dotenv

from calibrate_measurements import get_measurements

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()


def main():
    get_measurements()


if __name__ == '__main__':
    main()

