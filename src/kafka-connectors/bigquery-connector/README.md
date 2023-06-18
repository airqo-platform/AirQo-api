# BigQuery connector

Prerequisites
Add the `.env` & `google_application_credentials.json` files to this directory.

## To run in a virtual environment

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## To listen to devices
```bash
python main.py --target=devices-source-connector
```
