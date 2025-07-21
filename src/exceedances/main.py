import argparse
from exceedance import calculate_exceedance

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the uptime.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    calculate_exceedance(args.tenant)
