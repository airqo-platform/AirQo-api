# AirQloud Analysis

A Python library for analyzing data from IoT AirQo devices to provide insights on sensor health, device uptime, data completeness, and more.

## Installation

```bash
pip install airqloudanalysis
```

## Features

- Sensor health analysis
- Device uptime monitoring
- Data completeness metrics
- Battery performance analysis
- Support for device-specific and AirQloud-level analysis


## Notable changes to this library
### Library version changes
The latest version includes changes to the following functions:

### print_devices_with_time_diff_flag_zero
This function has been replaced by the offline and online functions as they are more descriptive.

### Calculate_uptime
Altered to use start and end date to fill in the null while computing the collective uptime  and now takes in two extra parameters: start and end date 
    Function call is calculate_uptime(dataframe df, string start, string end)

### Online devices list 
This provides a variation of the timeLastPost function providing a list of online devices, their device numbers, time difference, and the airqlouds they belong to
    Function call is onlineDeviceList(dataframe df):

### Offline devices list
This provides a variation of the timeLastPost function providing a list of offline devices, their device numbers, time difference, and the airqlouds they belong to
    Function call is offlineDeviceList(dataframe df):

## Usage
These are the essential functions used both in general and device specific analysis
```python
import airqloudanalysis as aqa

# Initialize with your API token
token = "your_api_token"
for google sheets
file_path = "file path"

airQlouds = ["Kampala", "Nairobi"]
or 
deviceNames = ['aq_g4_95', 'aq_23']

start = "2023-01-01"
end = "2023-01-31"
maintenenceDate = date(2025, 3, 1)


# Get device data
AQData = aqa.airqloudlist(file_path, excel_file, airQlouds, deviceNames)

#Initialisation of the data frame
final_df = aqa.process_data(AQData, start, end)

#List of devices and last post
device_time_diff = aqa.timeLastPost(AQData)

#List of online devices
onlineDeviceList = aqa.onlineDeviceList(device_time_diff)

#List of offline devices
offlineDeviceList = aqa.offlineDeviceList(device_time_diff)

#Calculating the uptime
final_uptime_data = aqa.calculate_uptime(final_df, start, end)

# Calculate uptime
uptime_data = aqa.calculate_uptime(processed_data, start, end)

```

## Full Documentation

For complete documentation and examples, please visit:
https://docs.google.com/document/d/1Dc4zQceYjoXDwmHKy99hp7x49kq8LtoSAXBA-1HMwA4/edit?usp=sharing

The repository for this library 
https://github.com/OlukaGibson/deviceAnalysisLibrary.git

## License

This project is licensed under the terms of the license included in the repository.

## Author

- AirQo - <gibson@airqo.net>
