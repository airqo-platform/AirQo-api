import argparse
import os

import urllib3
from dotenv import load_dotenv

from transformation import Transformation

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def run_function():
    parser = argparse.ArgumentParser(description="Function configuration")
    parser.add_argument(
        "--action",
        required=True,
        type=str.lower,
        help="method to run",
        choices=[
            "approximate_site_coordinates",
            "site_tahmo_mapping",
            "sites_without_primary_device",
            "update_site_search_names",
            "devices_without_forecast",
            "refresh_sites",
            "export_sites",
            "export_devices",
        ],
    )
    parser.add_argument(
        "--tenant",
        required=False,
        type=str.lower,
        default="airqo",
        choices=[
            "airqo",
            "kcca",
        ],
    )
    parser.add_argument(
        "--outputFormat",
        required=False,
        type=str.lower,
        default="csv",
        choices=[
            "csv",
            "json",
            "api",
        ],
    )
    args = parser.parse_args()

    transformation = Transformation(args.outputFormat)

    if args.action == "site_tahmo_mapping":
        transformation.map_sites_to_tahmo_station()

    elif args.action == "sites_without_primary_device":
        transformation.get_sites_without_a_primary_device()

    elif args.action == "update_site_search_names":
        transformation.update_site_search_names()

    elif args.action == "devices_without_forecast":
        transformation.get_devices_without_forecast()

    elif args.action == "refresh_sites":
        transformation.refresh_sites()

    elif args.action == "export_sites":
        transformation.metadata_to_csv(component="sites", tenant=args.tenant)

    elif args.action == "export_devices":
        transformation.metadata_to_csv(component="devices", tenant=args.tenant)

    elif args.action == "approximate_site_coordinates":
        transformation.approximate_site_coordinates(tenant=args.tenant)

    else:
        pass


if __name__ == "__main__":
    run_function()
