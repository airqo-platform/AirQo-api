# Fault detection

## To run in a virtual environment

### Create a virtual environment and install requirements
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Train the models **(one time)**
```bash
python jobs\train_catboost_model.py
python jobs\train_lstm_model.py
```
### Expose the API
```bash
flask run
```

##  Predict faults - catboost

Make a `POST` request to `http://localhost:4001/api/v1/predict-faults/catboost` with the following raw JSON payload in the body:

```json
{
    "datetime": "2020-07-15T13:00",
    "raw_values": [
        {
            "datetime": "2020-07-15T13:03",
            "device_id": "aq_01",
            "s1_pm2.5": 44.12,
            "s2_pm2.5": 44.12
        },
        {
            "datetime": "2020-07-15T13:05",
            "device_id": "aq_02",
            "s1_pm2.5": 12.12,
            "s2_pm2.5": 43.12
        },
        {
            "datetime": "2020-07-15T13:07",
            "device_id": "aq_03",
            "s1_pm2.5": 80,
            "s2_pm2.5": 80.12
        }
    ]
}
```

## Predict faults - lstm

Make a `POST` request to `http://localhost:4001/api/v1/predict-faults/lstm` with the following raw JSON payload in the body:

```json
{
    "datetime": "2020-07-15 13:00:00",
    "raw_values": [
        {
            "datetime": "2020-07-15T13:03",
            "device_id": "aq_01",
            "s1_pm2.5": 44.12,
            "s2_pm2.5": 44.12
        },
        {
            "datetime": "2020-07-15T13:05",
            "device_id": "aq_02",
            "s1_pm2.5": 12.12,
            "s2_pm2.5": 43.12
        },
        {
            "datetime": "2020-07-15T13:07",
            "device_id": "aq_03",
            "s1_pm2.5": 80,
            "s2_pm2.5": 80.12
        }
    ]
}
```
