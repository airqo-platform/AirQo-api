from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import ForecastUtils


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
        from datetime import datetime, timedelta

        start_date = datetime.utcnow() - timedelta(
            hours=int(configuration.HOURLY_FORECAST_PREDICTION_JOB_SCOPE)
        )
        from airqo_etl_utils.date import date_to_str

        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_historical_data(start_date)

    @task()
    def preprocess_historical_data_hourly_forecast(data):
        return ForecastUtils.preprocess_historical_data(data, "hourly")

    @task()
    def add_lag_features_historical_data_hourly_forecast(data):
        return ForecastUtils.get_lag_features(data, "pm2_5", frequency="hourly")

    @task
    def add_timestep_features_historical_data_hourly_forecasts(data):
        return ForecastUtils.get_time_features(data)

    @task()
    def make_hourly_forecasts(data):
        return ForecastUtils.generate_hourly_forecasts(
            data, project_id, bucket, "hourly_forecast_model.pkl"
        )

    @task()
    def save_hourly_forecasts_to_bigquery(data):
        BigQueryApi().save_forecasts_to_bigquery(
            data, configuration.BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE
        )


    @task()
    def save_hourly_forecasts_to_mongo(data):
        ForecastUtils.save_forecasts_to_mongo(data, "hourly")

    # Daily forecast tasks

    @task()
    def get_historical_data_for_daily_forecasts():
        from datetime import datetime, timedelta
        from airqo_etl_utils.date import date_to_str

        start_date = datetime.utcnow() - timedelta(
            days=int(configuration.DAILY_FORECAST_PREDICTION_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_historical_data(start_date)

    @task()
    def preprocess_historical_data_daily_forecast(data):
        return ForecastUtils.preprocess_historical_data(data, "daily")

    @task()
    def add_lag_features_historical_data_daily_forecast(data):
        return ForecastUtils.get_lag_features(data, "pm2_5", frequency="daily")

    @task()
    def add_timestep_features_historical_data_daily_forecast(data):
        return ForecastUtils.get_time_features(data)

    @task()
    def make_daily_forecasts(data):
        return ForecastUtils.generate_daily_forecasts(
            data, project_id, bucket, "daily_forecast_model.pkl"
        )

    @task()
    def save_daily_forecasts_to_bigquery(data):
        BigQueryApi().save_forecasts_to_bigquery(
            data, configuration.BIGQUERY_DAILY_FORECAST_EVENTS_TABLE
        )

    @task()
    def save_daily_forecasts_to_mongo(data):
        ForecastUtils.save_forecasts_to_mongo(data, "daily")

    hourly_data = get_historical_data_for_hourly_forecasts()
    preprocessed_hourly_data = preprocess_historical_data_hourly_forecast(hourly_data)
    lagged_hourly_data = add_lag_features_historical_data_hourly_forecast(
        preprocessed_hourly_data
    )
    time_features_hourly_data = add_timestep_features_historical_data_hourly_forecasts(
        lagged_hourly_data
    )
    hourly_forecasts = make_hourly_forecasts(time_features_hourly_data)
    save_hourly_forecasts_to_bigquery(hourly_forecasts)
    save_hourly_forecasts_to_mongo(hourly_forecasts)

    daily_data = get_historical_data_for_daily_forecasts()
    preprocessed_daily_data = preprocess_historical_data_daily_forecast(daily_data)
    lagged_daily_data = add_lag_features_historical_data_daily_forecast(
        preprocessed_daily_data
    )
    time_features_daily_data = add_timestep_features_historical_data_daily_forecast(
        lagged_daily_data
    )
    daily_forecasts = make_daily_forecasts(time_features_daily_data)
    save_daily_forecasts_to_bigquery(daily_forecasts)
    save_daily_forecasts_to_mongo(daily_forecasts)


make_forecasts()
