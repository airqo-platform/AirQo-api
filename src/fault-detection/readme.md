# Fault detection

## To run in a virtual environment

1. Create a virtual environment
2. `pip install -r requirements.txt`
3. `flask run`

## Calibrate Endpoint

Make a "POST" request to http://localhost:4001/api/v1/predict_faults with the following raw JSON payload in the body:

```{json}
{
    "datetime": "2020-07-15 13:00:00",
    "raw_values": [
        {
        "time": "2020-07-15 13:03",
        "device_id":"aq_01",
        "pm2.5": 44.12 ,
        "s2_pm2.5": 44.12
        },
        {
        "time": "2020-07-15 13:05",
        "device_id":"aq_01",
        "pm2.5": 12.12 ,
        "s2_pm2.5": 43.12

        },
        {
        "time": "2020-07-15 13:07",
        "device_id":"aq_03",
        "pm2.5": 80 ,
        "s2_pm2.5": 80.12

        }
        ]
}
```
