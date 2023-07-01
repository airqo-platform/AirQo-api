# Forecast API documentation
## Introduction
This page conatins AirQo’s Forecast API and provides guidelines on how one can use it to access air quality PM2.5 forecasts for any particular location using the `site_id` query parameter, though work is ongoing to allow querying by other parameters such as `city`, `region`, etc.

## Forecasting
The concept of forecasting involves predicting or estimating a given value of a given variable such as temperature, price of a commodity at a future point in time. 

This can involve taking into account a number of factors such as how that value has changed in previous hours, days or weeks, as well as any other factors that may affect the value.

## Forecasting at AirQo
AirQo project has a large network of custom built air quality monitors placed in various locations within Uganda and Africa, We also have devices from other partners both local and international such as KCCA, the US Embassy amongst others. 

All these serve as sources for air quality data measured in `µg/m3`. This data is received at an hourly rate. Using this data, we are also able to leverage machine learning techniques to forecast the air quality of a given site / location or even region, using data that has been received so far along with other factors such as the location,etc.

To make air quality forecasts of  PM2.5 values, we take into accound details such as the `device_number`, `time`, `previous_day_pm2_5_value`, `previous_1_week_pm_2_5_value`, amongst others. 

The code used to train the models  for making `hourly_forecasts`(next 24 hours) and  `daily_forecasts`(next_1_week) is available [here](https://github.com/airqo-platform/AirQo-api/tree/staging/src/predict/jobs/forecast_training) for the model training and [here](https://github.com/airqo-platform/AirQo-api/tree/staging/src/predict/jobs/forecast) for the job to make the actual forecasts

The ability to accurately predict what air quality will be in the coming days is also essential for empowering everyone from governments to families to make informed decisions to protect health and guide action, just as we do with weather.

## Forecast API usage guidelines
Our forecast APi currently supports 2 endpoints, `hourly_forecast` and `daily_forecast`.

* Hourly forecasts (next 24 hours) - `{base_url}/api/v2/predict/hourly-forecast`
* Daily-forecasts (next 7 days) - `{base_url}/api/v2/predict/daily-forecast`

Listed below are the query parameters for both endpoints:
| Query Parameter      | Description |  Required        | Possible value | Constraints
| ------------- |:-------------:| -----:| --------:|-----:|
| `site_id`    | Site ID for location whose forecast is required | no | "640f19699b912345" | value must be a string & valid site on `airqo` network |
| `token`     |  Authorisation token required to use the endpoint | yes| `abcdefgh` | Value must be a string


### Sample Result
```

{
  forecast: {
            {
            "health_tips": [
                {
                    "_id": "64283ce9e82a77001e55c0b5",
                    "aqi_category": {
                        "max": 35.49,
                        "min": 12.1
                    },
                    "description": "Today is a great day for outdoor activity.",
                    "image":"link to image"
                    "title": "For Everyone"
                }
            ],
            "pm2_5": 23.405056521739112,
            "time": "2023-06-22T00:00:00+00:00"
        },
  }
}
````

# Running the app

## 1. fetch and checkout branch from github.

- ` git fetch origin [branchname]`
- ` git checkout [branchname]`

## 2. Create local python environment

### windows

    - ``` python -m venv [local_env_name]```

### linux/mac

    - ``` python3 -m venv [local_env_name]```

## 3. Activate the environment

    ### windows
    -  ```  [local_env_name]\Scripts\activate```

    ### linux/mac
    -  ```  source [local_env_name]/bin/activate```

## 4. Install dependencies using the requirements.txt

    -  ```  pip install -r requirements.txt ```

## 5. Set environment variables

    - Navigate to api directory
    - Add the `.env` file to directory. This can be obtained from secret manager (`predict-env-file`) or any active team member

- Add the `google_application_credentials.json` (`google-application-credentials`) to ` api directory(current directory)`. Obtain from a team member or GCP.
- Ensure all the necessary `ENV VARIABLES` are set and available i.e.
  - DB_NAME_STAGE=db-stage-name
  - DB_NAME_DEV=db-stage-dev
  - DB_NAME_PROD=db-production-name
  - FLASK_APP=filename.py
  - FLASK_ENV=target-environment
  - FLASK_RUN_PORT=portnumber
  - GOOGLE_APPLICATION_CREDENTIALS=credentials-file
  - MONGO_GCE_URI=connection_string_to_mongodb
  - MONGO_DEV_URI=connection_string_to_local_db
    - (local connection to db might need set up of mongodb container)
  - REDIS_PORT=redis port
  - REDIS_SERVER_PROD=sample redis server

## 6. Run the Flask App

    - ``` flask run```

## To build and run application with docker (Uses "" dockerfile.)

1. Ensure you're in `api` directory, if not change directory to it.

### Environment Setup

- Add the `.env` file to directory. This can be obtained from secret manager (`predict-env-file`) or any active team member
- Add the `google_application_credentials.json` (`google-application-credentials`) to ` api directory(current directory)`. Obtain from a team member or GCP.
- Ensure all the necessary `ENV VARIABLES` are set and available i.e.
  - DB_NAME_STAGE=db-stage-name
  - DB_NAME_DEV=db-stage-dev
  - DB_NAME_PROD=db-production-name
  - FLASK_APP=filename.py
  - FLASK_ENV=target-environment
  - FLASK_RUN_PORT=portnumber
  - GOOGLE_APPLICATION_CREDENTIALS=credentials-file
  - MONGO_GCE_URI=connection_string_to_mongodb
  - MONGO_DEV_URI=connection_string_to_local_db
    - (local connection to db might need set up of mongodb container)
  - REDIS_PORT=redis port
  - REDIS_SERVER_PROD=sample redis server

## Build the image targeting any specified environment

    - `docker build --target=[img-env-name]-t image-name .`
    -  `docker run -p 5000:5000 --env FLASK_ENV=[target-env] -it [image-name:latest]`

### e.g

     - `docker build --target=dev --tag forecast .`
     -  `docker run -p 5000:5000 --env FLASK_ENV=development -it forecast:latest`
