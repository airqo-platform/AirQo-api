# Calibrate microservice

## To run in a virtual environment

1. Add file `airqo-250220-5149c2aac8f2.json` to `jobs/`. Obtain from a team member or GCP.
1. Create a virtual environment
2. `pip install -r requirements.txt`
3. `flask run`

## To build and run with docker desktop

(Uses "production" dockerfile.)

1. Add file `airqo-250220-5149c2aac8f2.json` to `jobs/`. Obtain from a team member or GCP.
1. `docker build -t calibrate .`
2. `docker run -d -p 4001:4001 --env FLASK_APP=app.py --env FLASK_ENV=development --env MONGO_URI=mongodb://localhost:27017 calibrate`

It is implicit that `mongodb` should be installed and running.

## Check endpoint

Make a "POST" request to http://localhost:4001/api/v1/calibrate with the following raw JSON payload in the body:

```{json}
{
    "datetime": "2020-07-15 13:00:00",
    "raw_values": [
        {
            "device_id": "aq_01",
            "pm2.5": 44.12,
            "pm10": 54.20,
            "temperature": 25.3,
            "humidity": 62.0
        },
        {
            "device_id": "aq_02",
            "pm2.5": 35.42,
            "pm10": 41.53,
            "temperature": 26.5,
            "humidity": 57.0
        },
        {
            "device_id": "aq_03",
            "pm2.5": 36.34,
            "pm10": 43.06,
            "temperature": 27.0,
            "humidity": 56.0
        }
    ]
}
```