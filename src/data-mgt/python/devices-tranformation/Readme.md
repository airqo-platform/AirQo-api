# Device Transformations
Contains Utils for performing transformations on devices
## Setup your Environment
```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
```
Obtain and add the `.env` to this directory.

In scenarios where the output is  **csv** or **json**, a file named `output.json` or `output.csv` is generated with the data.
## Get active devices with invalid measurements
```bash
    python main.py get_devices_with_invalid_measurements csv
```
## Map sites to nearest Tahmo stations
Update sites to include the nearest Tahmo Station. 
### API post request to microservice managing sites
```bash
    python main.py site_tahmo_mapping api
```
### CSV output
```bash
    python main.py site_tahmo_mapping csv
```
## Map devices to nearest Tahmo stations
```bash
    python main.py device_tahmo_mapping json
```
## Get devices on Netmanager but missing on bigquery
```bash
    python main.py missing_devices_on_bigquery json
```
## Get sites without primary devices
```bash
    python main.py sites_without_a_primary_device csv
```
## Update primary devices based on csv file
```bash
    python main.py update_primary_devices
```
