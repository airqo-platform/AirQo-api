# Device Transformations

Contains Utils for manipulating devices' data

## Setup your Environment

```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
```

Add the `.env` to this directory. [link to env file](https://docs.google.com/document/d/12SFbaC9aECzQJDtGp4ECkLpMqVAnmQQ22QyqE2d9L94/edit?usp=sharing)

In scenarios where the output is  **csv** or **json**, a file named `output.json` or `output.csv` is generated with the
data.

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

## Get devices without forecast

```bash
    python main.py devices_without_forecast csv
```

## Update sites search names based on csv file

```bash
    python main.py update_site_search_names
```

## Export sites/devices to csv or json
```bash
    python main.py export_sites csv tenant
    python main.py export_devices csv tenant
```
