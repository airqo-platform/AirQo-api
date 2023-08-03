from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import ForecastUtils


@dag(
    'AirQo-forecasting-job',
    schedule='0 1 * * *',
    default_args=AirflowUtils.dag_default_configs(),
    tags=['airqo', 'hourly-forecast', 'daily-forecast', 'prediction-job']
)

def make_forecasts():
    bucket = configuration.FORECAST_MODELS_BUCKET
    project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
    @task()
    def get_hourly_forecast_data():
        return BigQueryApi().fetch_hourly_forecast_data()

    @task()
    def preprocess_hourly_forecast_data(data):
        return ForecastUtils.preprocess_hourly_forecast_data(data)

    @task()
    def add_hourly_lag_features(data):
        return ForecastUtils.get_hourly_lag_features(data, 'pm2_5')

    @task
    def add_hourly_time_features(data):
        return ForecastUtils.get_time_features(data)

    @task()
    def make_hourly_forecasts(data):
        return ForecastUtils.generate_hourly_forecasts(data, project_id, bucket, 'hourly_forecast_model.pkl')

    @task()
    def save_forecasts_to_bigquery(data):
        BigQueryApi().save_forecasts_to_bigquery(data, configuration.BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE)

    @task()
    def add_health_tips(data):
        return ForecastUtils.add_health_tips(data)

    @task()
    def save_hourly_forecasts(data):
        ForecastUtils.save_hourly_forecasts(data)

    @task()
    def get_daily_forecast_data():
        return BigQueryApi().fetch_monthly_forecast_data()

    @task()
    def preprocess_daily_forecast_data(data):
        return ForecastUtils.preprocess_daily_forecast_data(data)

    @task()
    def add_daily_lag_features(data):
        return ForecastUtils.get_daily_lag_features(data, 'pm2_5')

    @task()
    def add_daily_time_features(data):
        return ForecastUtils.get_time_features(data)

    @task()
    def make_daily_forecasts(data):
        return ForecastUtils.generate_daily_forecasts(data, project_id, bucket, 'daily_forecast_model.pkl')

    @task()
    def save_forecasts_to_bigquery(data):
        BigQueryApi().save_forecasts_to_bigquery(data, configuration.BIGQUERY_DAILY_FORECAST_EVENTS_TABLE)

    @task()
    def add_health_tips(data):
        return ForecastUtils.add_health_tips(data)

    @task()
    def save_daily_forecasts(data):
        ForecastUtils.save_daily_forecasts(data)

    hourly_data = get_hourly_forecast_data()
    preprocessed_hourly_data = preprocess_hourly_forecast_data(hourly_data)
    lagged_hourly_data = add_hourly_lag_features(preprocessed_hourly_data)
    time_features_hourly_data = add_hourly_time_features(lagged_hourly_data)
    hourly_forecasts = make_hourly_forecasts(time_features_hourly_data)
    save_forecasts_to_bigquery(hourly_forecasts)
    hourly_forecasts_with_health_tips = add_health_tips(hourly_forecasts)
    save_hourly_forecasts(hourly_forecasts_with_health_tips)

    daily_data = get_daily_forecast_data()
    preprocessed_daily_data = preprocess_daily_forecast_data(daily_data)
    lagged_daily_data = add_daily_lag_features(preprocessed_daily_data)
    time_features_daily_data = add_daily_time_features(lagged_daily_data)
    daily_forecasts = make_daily_forecasts(time_features_daily_data)
    save_forecasts_to_bigquery(daily_forecasts)
    daily_forecasts_with_health_tips = add_health_tips(daily_forecasts)
    save_daily_forecasts(daily_forecasts_with_health_tips)


make_forecasts()
