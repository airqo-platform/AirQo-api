import os
import sys

import urllib3
from dotenv import load_dotenv

from transformation import Transformation

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

if __name__ == '__main__':
    strings_list = sys.argv

    if len(strings_list) < 2:
        print("Please pass in at least one argument")
        exit()

    action = f"{strings_list[1]}"

    output_format = ""
    if len(strings_list) >= 3:
        output_format = f"{strings_list[2]}"

    transformation = Transformation(output_format)

    if action.lower().strip() == "device_tahmo_mapping":
        transformation.map_devices_to_tahmo_station()

    elif action.lower().strip() == "site_tahmo_mapping":
        transformation.map_sites_to_tahmo_station()

    elif action.lower().strip() == "sites_without_a_primary_device":
        transformation.get_sites_without_a_primary_device()

    elif action.lower().strip() == "missing_devices_on_bigquery":
        transformation.get_devices_not_up_to_date_on_big_query()

    else:
        print("Invalid Arguments. Check the Readme.md for valid arguments")
        exit()
