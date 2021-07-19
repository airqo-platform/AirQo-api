# Device Transformations

## Setup your Environment
###
```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
```
###
Add the `.env` to this directory. It can be obtained form the author. 
## To map devices to nearest Tahmo stations
Creates a `formatted_devices.[json.csv]` file containing devices with the nearest tahmo station added to devices that have `latitude` and `longitude` values. Default output format is `json`
### JSON output
```bash
    python main.py device_tahmo_mapping json
```
### CSV output
```bash
    python main.py device_tahmo_mapping csv
```
