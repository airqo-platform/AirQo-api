from datetime import datetime

from airflow.decorators import dag, task
from dateutil.relativedelta import relativedelta

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.ml_utils import MlPipelineUtils
from models.ml_models import Job, Frequency


@dag(
    "AirQo-forecast-models-training-job",
    schedule="0 1 * * 0",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job"],
)
def train_forecasting_models():
    # Hourly forecast tasks
    @task()
    def fetch_training_data_for_hourly_forecast_model():
        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.HOURLY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(start_date_time=start_date, job_type=Job.TRAIN)

    @task()
    def preprocess_training_data_for_hourly_forecast_model(data):
        return MlPipelineUtils.preprocess_data(
            data=data, data_frequency=Frequency.HOURLY, job_type=Job.TRAIN
        )

    @task()
    def get_hourly_lag_and_rolling_features(data):
        return MlPipelineUtils.get_lag_and_roll_features(
            df=data, target_col="pm2_5", frequency=Frequency.HOURLY
        )

    @task()
    def get_hourly_time_and_cyclic_features(data):
        return MlPipelineUtils.get_time_and_cyclic_features(
            df=data, frequency=Frequency.HOURLY
        )

    @task()
    def get_location_features(data):
        return MlPipelineUtils.get_location_features(df=data)

    @task()
    def train_and_save_hourly_forecast_model(train_data):
        return MlPipelineUtils.train_and_save_forecast_models(
            training_data=train_data, frequency=Frequency.HOURLY
        )

    # Daily forecast tasks
    @task()
    def fetch_training_data_for_daily_forecast_model():
        from dateutil.relativedelta import relativedelta
        from datetime import datetime

        current_date = datetime.today()
        start_date = current_date - relativedelta(
            months=int(configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(start_date_time=start_date, job_type=Job.TRAIN)

    @task()
    def preprocess_training_data_for_daily_forecast_model(data):
        return MlPipelineUtils.preprocess_data(
            data=data, data_frequency=Frequency.DAILY, job_type=Job.TRAIN
        )

    @task()
    def get_daily_lag_and_rolling_features(data):
        return MlPipelineUtils.get_lag_and_roll_features(
            df=data, target_col="pm2_5", frequency=Frequency.DAILY
        )

    @task()
    def get_daily_time_and_cylic_features(data):
        return MlPipelineUtils.get_time_and_cyclic_features(
            df=data, frequency=Frequency.DAILY
        )

    @task()
    def get_location_features(data):
        return MlPipelineUtils.get_location_features(df=data)

    @task()
    def train_and_save_daily_model(train_data):
        return MlPipelineUtils.train_and_save_forecast_models(
            training_data=train_data, frequency=Frequency.DAILY
        )

    hourly_data = fetch_training_data_for_hourly_forecast_model()
    hourly_preprocessed_data = preprocess_training_data_for_hourly_forecast_model(
        hourly_data
    )
    hourly_lag_data = get_hourly_lag_and_rolling_features(hourly_preprocessed_data)
    hourly_cyclic_data = get_hourly_time_and_cyclic_features(hourly_lag_data)
    hourly_loc_data = get_location_features(hourly_cyclic_data)
    train_and_save_hourly_forecast_model(hourly_loc_data)

    daily_data = fetch_training_data_for_daily_forecast_model()
    daily_preprocessed_data = preprocess_training_data_for_daily_forecast_model(
        daily_data
    )
    daily_lag_data = get_daily_lag_and_rolling_features(daily_preprocessed_data)
    daily_cyclic_data = get_daily_time_and_cylic_features(daily_lag_data)
    daily_loc_data = get_location_features(daily_cyclic_data)
    train_and_save_daily_model(daily_loc_data)


train_forecasting_models()
