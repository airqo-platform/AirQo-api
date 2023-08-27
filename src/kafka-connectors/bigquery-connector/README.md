# BigQuery connector

## Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Add the following to your `.env` file

| Variable                         | Description                                                                                  |
| :------------------------------- | :------------------------------------------------------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | **Required**. Points to a google credentials file with permissions to update BigQuery tables |
| `DEVICES_TABLE`                  | **Required**. BigQuery table with devices                                                    |
| `SITES_TABLE`                    | **Required**. BigQuery table with sites                                                      |
| `AIRQLOUDS_SITES_TABLE`          | **Required**. BigQuery table with sites and airqlouds                                        |
| `AIRQLOUDS_TABLE`                | **Required**. BigQuery table with airqlouds                                                  |
| `BOOTSTRAP_SERVERS`              | **Required**. Bootstrap servers                                                              |
| `AIRQLOUDS_TOPIC`                | **Required**. AirQlouds topic                                                                |
| `SITES_TOPIC`                    | **Required**. Sites topic                                                                    |
| `DEVICES_TOPIC`                  | **Required**. Devices topic                                                                  |

## To listen to devices

```bash
python main.py --target=devices-source-connector
```

trigger
