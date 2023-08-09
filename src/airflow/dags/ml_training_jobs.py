from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import ForecastUtils


@dag(
    "AirQo-forecast-models-training-job",
    schedule="0 1 * * 1",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "hourly-forecast", "daily-forecast", "training-job"],
)
def train_forecasting_models():
    project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
    bucket = configuration.FORECAST_MODELS_BUCKET

    @task()
    def fetch_training_data_for_hourly_forecast_model():
        return BigQueryApi().fetch_training_data_forecast_model(
            months_of_data=configuration.HOURLY_FORECAST_TRAINING_JOB_SCOPE
        )

    @task()
    def preprocess_training_data_for_hourly_forecast_model(data):
        return ForecastUtils.preprocess_training_data(data, "hourly")

    @task()
    def feature_engineer_training_data_for_hourly_forecast_model(data):
        return ForecastUtils.feature_eng_training_data(data, "pm2_5", "hourly")

    @task()
    def train_hourly_forecast_model(train_data):
        return ForecastUtils.train_hourly_forecast_model(train_data)

    @task()
    def save_hourly_forecast_model(model):
        ForecastUtils.upload_trained_model_to_gcs(
            model, project_id, bucket, "hourly_forecast_model.pkl"
        )

    @task()
    def fetch_training_data_for_daily_forecast_model():
        return BigQueryApi().fetch_training_data_forecast_model(
            months_of_data=configuration.DAILY_FORECAST_TRAINING_JOB_SCOPE
        )

    @task()
    def preprocess_training_data_for_daily_forecast_model(data):
        return ForecastUtils.preprocess_training_data(data, "daily")

    @task()
    def feature_engineer_data_for_daily_forecast_model(data):
        return ForecastUtils.feature_eng_training_data(data, "pm2_5", "daily")

    @task()
    def train_daily_model(train_data):
        return ForecastUtils.train_daily_forecast_model(train_data)

    @task()
    def save_daily_forecast_model(model):
        ForecastUtils.upload_trained_model_to_gcs(
            model, project_id, bucket, "daily_forecast_model.pkl"
        )

    hourly_data = fetch_training_data_for_hourly_forecast_model()
    preprocessed_hourly_data = preprocess_training_data_for_hourly_forecast_model(
        hourly_data
    )
    hourly_data = feature_engineer_training_data_for_hourly_forecast_model(
        preprocessed_hourly_data
    )
    hourly_model = train_hourly_forecast_model(hourly_data)
    save_hourly_forecast_model(hourly_model)

    daily_data = fetch_training_data_for_daily_forecast_model()
    preprocessed_daily_data = preprocess_training_data_for_daily_forecast_model(
        daily_data
    )
    daily_data = feature_engineer_data_for_daily_forecast_model(preprocessed_daily_data)
    daily_model = train_daily_model(daily_data)
    save_daily_forecast_model(daily_model)


# train_forecasting_models()
