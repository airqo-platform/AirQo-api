import argparse
from device_status import compute_device_channel_status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the status.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    compute_device_channel_status(args.tenant)
