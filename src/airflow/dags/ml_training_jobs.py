from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.ml_utils import ForecastUtils


@dag(
    "AirQo-forecast-models-training-job",
    schedule="0 1 * * 0",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job"],
)
def train_forecasting_models():
    @task()
    def fetch_training_data_for_hourly_forecast_model():
        from dateutil.relativedelta import relativedelta
        from datetime import datetime

        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.HOURLY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(start_date)

    @task()
    def preprocess_training_data_for_hourly_forecast_model(data):
        return ForecastUtils.preprocess__data(data, "hourly")

    @task()
    def feature_engineer_training_data_for_hourly_forecast_model(data):
        return ForecastUtils.feature_eng_training_data(data, "pm2_5", "hourly")

    @task()
    def train_and_save_hourly_forecast_model(train_data):
        return ForecastUtils.train_and_save_hourly_forecast_model(train_data)

    @task()
    def fetch_training_data_for_daily_forecast_model():
        from dateutil.relativedelta import relativedelta
        from datetime import datetime

        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(start_date)

    @task()
    def preprocess_training_data_for_daily_forecast_model(data):
        return ForecastUtils.preprocess__data(data, "daily")

    @task()
    def feature_engineer_data_for_daily_forecast_model(data):
        return ForecastUtils.feature_eng_training_data(data, "pm2_5", "daily")

    @task()
    def train_and_save_daily_model(train_data):
        return ForecastUtils.train_and_save_daily_forecast_model(train_data)

    hourly_data = fetch_training_data_for_hourly_forecast_model()
    hourly_data = preprocess_training_data_for_hourly_forecast_model(hourly_data)
    hourly_data = feature_engineer_training_data_for_hourly_forecast_model(hourly_data)
    train_and_save_hourly_forecast_model(hourly_data)

    daily_data = fetch_training_data_for_daily_forecast_model()
    daily_data = preprocess_training_data_for_daily_forecast_model(daily_data)
    daily_data = feature_engineer_data_for_daily_forecast_model(daily_data)
    train_and_save_daily_model(daily_data)


train_forecasting_models()
