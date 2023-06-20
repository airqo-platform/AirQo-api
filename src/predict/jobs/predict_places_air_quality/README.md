## Setup

1. Clone the repository:
    ```shell
    git clone https://github.com/airqo-platform/AirQo-api.git
    ```

2. Navigate to the project directory:
    ```shell
    cd src/predict/jobs/predict_places_air_quality
    ```

3. Create and activate a python environment:
    ```shell
    python3 -m venv venv && source venv/bin/activate
    ```
   
4. Install the required dependencies:
    ```shell
    pip install -r requirements.txt
    ```

## Environment Variables

You will need to add the following environment variables to your `.env` file

| Variable                         | Description                                                                  |
|:---------------------------------|:-----------------------------------------------------------------------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | **Required**. Points a a google credentials file to write to BigQuery tables |
| `BIGQUERY_HOURLY_DATA`           | **Required**. BigQuery table with hourly data                                |
| `BIGQUERY_AIRQLOUDS_SITES`       | **Required**. BigQuery table with sites and airqlouds                        |
| `BIGQUERY_SITES`                 | **Required**. BigQuery table with sites                                      |
| `MONGO_URI`                      | **Required**. Mong DB URI                                                    |
| `MONGO_DB`                       | **Required**. Mongo DB where shapefiles are stored                           |
| `MONGO_SHAPE_FILES_COLLECTION`   | **Required**. Mongo collection with shapefiles                               |
| `AIRQO_API_TOKEN`                | **Required**. Your AirQo API token                                           |
| `DEVICE_REGISTRY_URL`            | **Required**. e.g https://api.airqo.net/api/v1/devices                       |
| `BIGQUERY_PLACES_PREDICTIONS`    | **Required**. BigQuery table to store predictions                            |
| `POSTGRES_TABLE`                 | **Required**. e.g PostgresSQL table                                          |
| `POSTGRES_CONNECTION_URL`        | **Required**. PostgresSQL db connection string                               |

## Predict and store air quality

 ```shell
 python main.py
 ```
