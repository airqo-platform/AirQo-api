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
    python main.py --action=site_tahmo_mapping --outputFormat=api
```


## Get sites without primary devices

```bash
    python main.py --action=sites_without_a_primary_device --outputFormat=csv
```

## Update primary devices based on csv file

```bash
    python main.py --action=update_primary_devices
```

## Get devices without forecast

```bash
    python main.py --action=devices_without_forecast csv
```

## Refresh sites

```bash
    python main.py --action=refresh_sites 
```

## Update sites search names based on csv file
Updates the `search_name` and `location_name` of sites. You must add to this directory a `sites.csv` file containing `search_name`, `location_name` and `id` of the sites to  be updated.

Sample `sites.csv` file

| id         | search_name  | location_name   | tenant |
|------------|--------------|-----------------|--------|
| site_01_id | Masaka       | Central, Uganda | airqo  |
| site_02_id | KCCA Offices | Kampala, Uganda | kcca   |

```bash
    python main.py --action=update_site_search_names
```

## Export sites/devices to csv or json
```bash
    python main.py --action=export_sites --outputFormat=csv
    python main.py --action=export_devices --outputFormat=json --tenant=airqo
```

## Approximate sites and devices coordinates
```bash
    python main.py --action=approximate_coordinates
```
