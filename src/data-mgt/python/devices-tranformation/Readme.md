# Device Transformations

## Setup your Environment
```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
```
Obtain and add the `.env` to this directory.
## Map sites to nearest Tahmo stations
Update sites to include the nearest Tahmo Station. Output depends on arguments passed in.
### API post request to microservice managing sites
```bash
    python main.py site_tahmo_mapping api
```
### CSV output
```bash
    python main.py site_tahmo_mapping csv
```
### JSON output
```bash
    python main.py site_tahmo_mapping json
```
## Map devices to nearest Tahmo stations
Creates a `formatted_devices.[json.csv]` file containing devices with the nearest tahmo station added to devices that have `latitude` and `longitude` values. Default output format is `json`
### CSV output
```bash
    python main.py device_tahmo_mapping csv
```
### JSON output
```bash
    python main.py device_tahmo_mapping json
```
## Get devices on Netmanager but missing on bigquery
### CSV output
```bash
    python main.py missing_devices_on_bigquery csv
```
### JSON output
```bash
    python main.py missing_devices_on_bigquery json
```
