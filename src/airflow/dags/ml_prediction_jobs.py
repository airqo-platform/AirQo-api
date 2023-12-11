from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import MlPipelineUtils
from models.ml_models import JobType, Frequency


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
        return BigQueryApi().fetch_data(
            start_date_time=start_date, job_type=JobType.prediction
        )

    @task()
    def preprocess_historical_data_hourly_forecast(data):
        return MlPipelineUtils.preprocess_data(
            data=data, data_frequency=Frequency.HOURLY, job_type=JobType.prediction
        )

    @task
    def generate_lag_and_rolling_features_hourly_forecast(data):
        return MlPipelineUtils.get_lag_and_roll_features(
            df=data, target_col="pm2_5", frequency=Frequency.HOURLY
        )

    @task()
    def get_time_and_cyclic_features_hourly_forecast(data):
        return MlPipelineUtils.get_time_and_cyclic_features(
            df=data, frequency=Frequency.HOURLY
        )

    @task()
    def get_location_features_hourly_forecast(data):
        return MlPipelineUtils.get_location_features(df=data)

    @task()
    def make_hourly_forecasts(data):
        return MlPipelineUtils.generate_forecasts(
            data=data,
            project_name=project_id,
            bucket_name=bucket,
            frequency=Frequency.HOURLY,
        )

    @task()
    def save_hourly_forecasts_to_bigquery(data):
        BigQueryApi().save_forecasts_to_bigquery(
            data, configuration.BIGQUERY_HOURLY_FORECAST_EVENTS_TABLE
        )

    @task()
    def save_hourly_forecasts_to_mongo(data):
        MlPipelineUtils.save_forecasts_to_mongo(data=data, frequency=Frequency.HOURLY)

    # Daily forecast tasks
    @task()
    def get_historical_data_for_daily_forecasts():
        from datetime import datetime, timedelta
        from airqo_etl_utils.date import date_to_str

        start_date = datetime.utcnow() - timedelta(
            days=int(configuration.DAILY_FORECAST_PREDICTION_JOB_SCOPE)
        )
        start_date = date_to_str(start_date, str_format="%Y-%m-%d")
        return BigQueryApi().fetch_data(
            start_date_time=start_date, job_type=JobType.prediction
        )

    @task()
    def preprocess_historical_data_daily_forecast(data):
        return MlPipelineUtils.preprocess_data(
            data=data, data_frequency=Frequency.DAILY, job_type=JobType.prediction
        )

    @task()
    def generate_lag_and_rolling_features_daily_forecast(data):
        return MlPipelineUtils.get_lag_and_roll_features(
            df=data, target_col="pm2_5", frequency=Frequency.DAILY
        )

    @task()
    def get_time_and_cyclic_features_daily_forecast(data):
        return MlPipelineUtils.get_time_and_cyclic_features(
            df=data, frequency=Frequency.DAILY
        )

    @task()
    def get_location_features_daily_forecast(data):
        return MlPipelineUtils.get_location_features(df=data)

    @task()
    def make_daily_forecasts(data):
        return MlPipelineUtils.generate_forecasts(
            data=data,
            project_name=project_id,
            bucket_name=bucket,
            frequency=Frequency.DAILY,
        )

    @task()
    def save_daily_forecasts_to_bigquery(data):
        BigQueryApi().save_forecasts_to_bigquery(
            data, configuration.BIGQUERY_DAILY_FORECAST_EVENTS_TABLE
        )

    @task()
    def save_daily_forecasts_to_mongo(data):
        MlPipelineUtils.save_forecasts_to_mongo(data, frequency=Frequency.DAILY)

    # Hourly forecast pipeline
    hourly_data = get_historical_data_for_hourly_forecasts()
    hourly_preprocessed_data = preprocess_historical_data_hourly_forecast(hourly_data)
    hourly_lag_and_roll_features = generate_lag_and_rolling_features_hourly_forecast(
        hourly_preprocessed_data
    )
    hourly_time_and_cyclic_features = get_time_and_cyclic_features_hourly_forecast(
        hourly_lag_and_roll_features
    )
    hourly_location_features = get_location_features_hourly_forecast(
        hourly_time_and_cyclic_features
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
    daily_time_and_cyclic_features = get_time_and_cyclic_features_daily_forecast(
        daily_lag_and_roll_features
    )
    daily_location_features = get_location_features_daily_forecast(
        daily_time_and_cyclic_features
    )
    daily_forecasts = make_daily_forecasts(daily_location_features)
    save_daily_forecasts_to_bigquery(daily_forecasts)
    save_daily_forecasts_to_mongo(daily_forecasts)


make_forecasts()
