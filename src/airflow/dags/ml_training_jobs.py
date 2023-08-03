from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.ml_utils import ForecastUtils


@dag(
    'AirQo-forecast-models-training-job',
    schedule='0 1 * * 1',
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=['airqo', 'hourly-forecast', 'daily-forecast', 'training-job']
)
def train_forecasting_models():
    project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
    bucket = configuration.FORECAST_MODELS_BUCKET
    @task()
    def fetch_hourly_forecast_training_data():
        return BigQueryApi().fetch_hourly_forecast_training_data()

    @task()
    def preprocess_hourly_data(data):
        return ForecastUtils.preprocess_hourly_training_data(data)

    @task()
    def feature_engineer_hourly_data(data):
        return ForecastUtils.feature_eng_hourly_training_data(data, 'pm2_5')

    @task()
    def train_hourly_model(train_data):
        return ForecastUtils.train_hourly_model(train_data)

    @task()
    def save_hourly_model(model):
        ForecastUtils.upload_trained_model_to_gcs(model, project_id, bucket,
                                                  'hourly_forecast_model.pkl')

    @task()
    def fetch_daily_forecast_training_data():
        return BigQueryApi().fetch_daily_forecast_training_data()

    @task()
    def preprocess_daily_data(data):
        return ForecastUtils.preprocess_daily_training_data(data)

    @task()
    def feature_engineer_daily_data(data):
        return ForecastUtils.feature_eng_daily_training_data(data, 'pm2_5')

    @task()
    def train_daily_model(train_data):
        return ForecastUtils.train_daily_model(train_data)

    @task()
    def save_daily_model(model):
        ForecastUtils.upload_trained_model_to_gcs(model, project_id, bucket,
                                                  'daily_forecast_model.pkl')


    hourly_data = fetch_hourly_forecast_training_data()
    preprocessed_hourly_data = preprocess_hourly_data(hourly_data)
    hourly_data = feature_engineer_hourly_data(preprocessed_hourly_data)
    hourly_model = train_hourly_model(hourly_data)
    save_hourly_model(hourly_model)

    daily_data = fetch_daily_forecast_training_data()
    preprocessed_daily_data = preprocess_daily_data(daily_data)
    daily_data = feature_engineer_daily_data(preprocessed_daily_data)
    daily_model = train_daily_model(daily_data)
    save_daily_model(daily_model)


train_forecasting_models()
