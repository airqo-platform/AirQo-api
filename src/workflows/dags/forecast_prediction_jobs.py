## This module contains DAGS for prediction/inference jobs of AirQo.

from datetime import datetime

from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.ml_utils import BaseMlUtils, ForecastUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "AirQo-forecasting-job",
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "hourly-forecast", "daily-forecast", "prediction-job"],
)
def make_forecasts():
    bucket = configuration.FORECAST_MODELS_BUCKET
    project_id = configuration.GOOGLE_CLOUD_PROJECT_ID

    ### Hourly forecast tasks
    @task()
    def get_historical_data_for_hourly_forecasts():
        from datetime import datetime, timedelta, timezone

        start_date = datetime.now(timezone.utc) - timedelta(
            hours=int(configuration.HOURLY_FORECAST_PREDICTION_JOB_SCOPE)
        )
        from airqo_etl_utils.date import date_to_str

        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(
            start_date, "prediction"
        )

    @task()
    def preprocess_historical_data_hourly_forecast(data):
        return BaseMlUtils.preprocess_data(data, "hourly", job_type="prediction")

    @task
    def generate_lag_and_rolling_features_hourly_forecast(data):
        return BaseMlUtils.get_lag_and_roll_features(data, "pm2_5", "hourly")

    @task()
    def get_time_features_hourly_forecast(data):
        return BaseMlUtils.get_time_features(data, "hourly")

    @task()
    def get_cyclic_features_hourly_forecast(data):
        return BaseMlUtils.get_cyclic_features(data, "hourly")

    @task()
    def get_location_features_hourly_forecast(data):
        return BaseMlUtils.get_location_features(data)

    @task()
    def make_hourly_forecasts(data):
        return ForecastUtils.generate_forecasts(
            data=data, project_name=project_id, bucket_name=bucket, frequency="hourly"
        )

    @task()
    def save_hourly_forecasts_to_bigquery(data):
        BigQueryApi().save_data_to_bigquery(
            data, configuration.BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE
        )

    @task()
    def save_hourly_forecasts_to_mongo(data):
        ForecastUtils.save_forecasts_to_mongo(data, "hourly")

    # Daily forecast tasks
    @task()
    def get_historical_data_for_daily_forecasts():
        from datetime import datetime, timedelta, timezone
        from airqo_etl_utils.date import date_to_str

        start_date = datetime.now(timezone.utc) - timedelta(
            days=int(configuration.DAILY_FORECAST_PREDICTION_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_device_data_for_forecast_job(
            start_date, "prediction"
        )

    @task()
    def preprocess_historical_data_daily_forecast(data):
        return BaseMlUtils.preprocess_data(data, "daily", job_type="prediction")

    @task()
    def generate_lag_and_rolling_features_daily_forecast(data):
        return BaseMlUtils.get_lag_and_roll_features(data, "pm2_5", "daily")

    @task()
    def get_time_features_daily_forecast(data):
        return BaseMlUtils.get_time_features(data, "daily")

    @task()
    def get_cyclic_features_daily_forecast(data):
        return BaseMlUtils.get_cyclic_features(data, "daily")

    @task()
    def get_location_features_daily_forecast(data):
        return BaseMlUtils.get_location_features(data)

    @task()
    def make_daily_forecasts(data):
        return ForecastUtils.generate_forecasts(
            data=data, project_name=project_id, bucket_name=bucket, frequency="daily"
        )

    @task()
    def save_daily_forecasts_to_bigquery(data):
        BigQueryApi().save_data_to_bigquery(
            data, configuration.BIGQUERY_DAILY_FORECAST_EVENTS_TABLE
        )

    @task()
    def save_daily_forecasts_to_mongo(data):
        ForecastUtils.save_forecasts_to_mongo(data, "daily")

    # Hourly forecast pipeline
    hourly_data = get_historical_data_for_hourly_forecasts()
    hourly_preprocessed_data = preprocess_historical_data_hourly_forecast(hourly_data)
    hourly_lag_and_roll_features = generate_lag_and_rolling_features_hourly_forecast(
        hourly_preprocessed_data
    )
    hourly_time_features = get_time_features_hourly_forecast(
        hourly_lag_and_roll_features
    )
    hourly_cyclic_features = get_cyclic_features_hourly_forecast(hourly_time_features)
    hourly_location_features = get_location_features_hourly_forecast(
        hourly_cyclic_features
    )
    hourly_forecasts = make_hourly_forecasts(hourly_location_features)
    save_hourly_forecasts_to_bigquery(hourly_forecasts)
    save_hourly_forecasts_to_mongo(hourly_forecasts)

    # Daily forecast pipeline
    daily_data = get_historical_data_for_daily_forecasts()
    daily_preprocessed_data = preprocess_historical_data_daily_forecast(daily_data)
    daily_lag_and_roll_features = generate_lag_and_rolling_features_daily_forecast(
        daily_preprocessed_data
    )
    daily_time_features = get_time_features_daily_forecast(daily_lag_and_roll_features)
    daily_cyclic_features = get_cyclic_features_daily_forecast(daily_time_features)
    daily_location_features = get_location_features_daily_forecast(
        daily_cyclic_features
    )
    daily_forecasts = make_daily_forecasts(daily_location_features)
    save_daily_forecasts_to_bigquery(daily_forecasts)
    save_daily_forecasts_to_mongo(daily_forecasts)


make_forecasts()