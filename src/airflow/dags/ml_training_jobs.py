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
    bucket = configuration.BUCKET_NAME

    @task()
    def fetch_training_data():
        return BigQueryApi().fetch_forecast_training_data()

    @task()
    def preprocess_data(hourly_df, daily_df):
        return ForecastUtils.preprocess_training_data(hourly_df, daily_df)

    @task()
    def feature_selection(hourly_df, daily_df):
        return ForecastUtils.feature_eng_training_data(hourly_df, daily_df)

    @task()
    def train_models(hourly_train, daily_train):
        return ForecastUtils.train_models(hourly_train, daily_train)

    @task()
    def save_models(hourly_model, daily_model):
        ForecastUtils.upload_trained_model_to_gcs(hourly_model, daily_model, project_id, bucket,
                                                  'hourly_forecast_model.pkl',
                                                  'daily_forecast_model.pkl')

    hourly_df, daily_df = fetch_training_data()
    hourly_df, daily_df = preprocess_data(hourly_df, daily_df)
    hourly_df, daily_df = feature_selection(hourly_df, daily_df)
    hourly_clf, daily_clf = train_models(hourly_df, daily_df)

    save_models(hourly_clf, daily_clf)


train_forecasting_models()
