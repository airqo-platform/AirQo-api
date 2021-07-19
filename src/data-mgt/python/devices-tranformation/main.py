import sys

from dotenv import load_dotenv

import Tranformation

load_dotenv()

if __name__ == '__main__':
    strings_list = sys.argv

    if len(strings_list) < 2:
        print("Please pass in at least one argument")
        exit()

    action = f"{strings_list[1]}"

    output_format = ""
    if len(strings_list) >= 3:
        output_format = f"{strings_list[2]}"

    if action.lower().strip() == "device_tahmo_mapping":
        Tranformation.map_devices_to_tahmo_station(output_format)
    else:
        print("Invalid Arguments. Check the Readme.md for valid arguments")
        exit()
