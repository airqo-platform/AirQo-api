import argparse
from controllers import status
from dotenv import load_dotenv
load_dotenv()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the status.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    status.compute_device_channel_status(args.tenant)
