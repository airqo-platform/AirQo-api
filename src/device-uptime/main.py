import argparse
from device_uptime import save_device_uptime

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the uptime.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    save_device_uptime(args.tenant)
