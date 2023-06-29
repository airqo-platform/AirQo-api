#Forecast API documentation
## Introduction
This document discusses AirQo’s Forecast API and provides guidelines on how one can use it to access air quality PM2.5 forecasts for any particular location using the `site_id` query parameter, though work is ongoing to allow querying by other parameters such as `city`, `region`, etc.

## Forecasting
The concept of forecasting is at its core concerned with predicting or estimating a given value of a given variable such as temperature, price of a commodity at a future point in time. 
This can involve taking into account a number of factors such as how that value has changed in previous hours, days or weeks, as well as any other factors that may affect the value.To forcast air quality PM2.5 values, we take into accound details such as the .device that 


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
