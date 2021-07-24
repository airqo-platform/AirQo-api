# Calibrate-multi-hop microservice

## To run in a virtual environment

1. Create a virtual environment `python -m venv ./venv`
2. Create a `.env` file with these keys set
    * **FLASK_APP**
    * **FLASK_ENV**
    * **FLASK_RUN_PORT**
    * ***MONGO_GCE_URI**
    * **MONGO_DEV_URI**
    * **DB_NAME_PROD**
    * **DB_NAME_STAGE**
    * **DB_NAME_DEV**
    * **SECRET_KEY**
 
3. Start the virtual env `source venv/bin/activate`
4. Install requirements `pip install -r requirements.txt`
5. Run application `flask run`

## To build and run with docker desktop

1. `docker build -t calibrate-multi-hop .`
2. `docker run -d -p 4001:4001 --env FLASK_APP=app.py --env FLASK_ENV=development --env MONGO_URI=mongodb://localhost:27017 calibrate-multi-hop`

It is implicit that `mongodb` should be installed and running.

## Check endpoint

Make a "POST" request to http://localhost:4001/api/v1/calibrate/multihop with the following raw JSON payload in the body:

```{json}
{
    "datetime": "2020-09-06 12:56:59+00:00",
    "raw_values": [
        {
            "raw_value": 100,
            "sensor_id": 832251
        },
        {
            "raw_value": 22,
            "sensor_id": 82720
        },
        {
            "raw_value": 29,
            "sensor_id": 870144
        }
    ]
}
```