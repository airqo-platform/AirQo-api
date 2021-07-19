import sys

import Tranformation

if __name__ == '__main__':
    strings_list = sys.argv

    if len(strings_list) != 2:
        print("Please pass in only one argument")
        exit()

    arg = f"{strings_list[1]}"

    if arg.lower().strip() == "device_tahmo_mapping":
        Tranformation.map_devices_to_tahmo_station()
    else:
        print("Invalid Arguments. Check the Readme.md for valid arguments")
        exit()
