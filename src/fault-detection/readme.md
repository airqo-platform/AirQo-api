# Fault detection

## To run in a virtual environment

1. Create a virtual environment
2. `$ pip install -r requirements.txt`
3. `$ python jobs\train.py` **(one time)**
4. `$ flask run`

##  predict faults catboost

Make a "POST" request to http://localhost:4001/api/v1/predict-faults/catboost with the following raw JSON payload in the body:

```{json}
{
    "datetime": "2020-07-15T13:00",
    "raw_values":[
        {
        "time": "2020-07-15T13:03",
        "device_id":"aq_01",
        "s1_pm2.5": 44.12 ,
        "s2_pm2.5": 44.12
        },
        {
        "time": "2020-07-15T13:05",
        "device_id":"aq_01",
        "s1_pm2.5": 12.12 ,
        "s2_pm2.5": 43.12

        },
        {
        "time": "2020-07-15T13:07",
        "device_id":"aq_03",
        "s1_pm2.5": 80 ,
        "s2_pm2.5": 80.12

        }]

1. Create a virtual environment
2. `cd AirQo-api/src/fault-detection`
2. `pip install -r requirements.txt`
3. `python jobs/classification.py`
4. `flask run`


## predict faults lstm

Make a "POST" request to http://localhost:4001/api/v1/predict-faults/lstm with the following raw JSON payload in the body:

```{json}
{
 "datetime": "2020-07-15 13:00:00", 
"raw_values": [ 
{
"datetime": "2020-07-15 13:03",
"device_id":"aq_01", 
"sensor1_pm2.5": 44.12 , 
"sensor2_pm2.5": 44.12 
}, 
{
"datetime": "2020-07-15 13:05",
"device_id":"aq_01", 
"sensor1_pm2.5": 12.12 , 
"sensor2_pm2.5": 43.12

}, 
{
"datetime": "2020-07-15 13:07",
"device_id":"aq_03", 
"sensor1_pm2.5": 80 , 
"sensor2_pm2.5": 80.12

}
]
}
```
