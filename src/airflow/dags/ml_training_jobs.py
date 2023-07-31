from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.ml_utils import ForecastUtils


@dag(
    'AirQo-forecast-models-training-job',
    schedule='0 1 * * 1',
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=['airqo', 'hourly-forecast', 'daily-forecast', 'training-job']
)
def train_forecasting_models():
    import warnings
    import mlflow
    import mlflow.sklearn
    from lightgbm import LGBMRegressor, early_stopping
    from config import configuration, environment

    warnings.filterwarnings("ignore")

    mlflow.set_tracking_uri(configuration.MLFLOW_TRACKING_URI)
    mlflow.set_experiment(experiment_name=f"daily_forecast_{environment}")

    print(f'mlflow server uri: {mlflow.get_tracking_uri()}')

    @task()
    def fetch_training_data():
        return BigQueryApi().fetch_forecast_training_data()

    @task()
    def preprocess_data(hourly_df, daily_df):
        return ForecastUtils.preprocess_training_data(hourly_df, daily_df)

    @task()
    def feature_selection(hourly_df, daily_df):
        return ForecastUtils.feature_eng_df(hourly_df, daily_df)

    @task()
    def train_models(hourly_df, daily_df):
        return ForecastUtils.train_model(hourly_df, daily_df)

    @task()
    def save_models(hourly_clf, daily_clf):
        ForecastUtils.upload_trained_model_to_gcs(daily_clf, hourly_clf, configuration.GOOGLE_CLOUD_PROJECT_ID)

    hourly_df, daily_df = fetch_training_data()
    hourly_df, daily_df = preprocess_data(hourly_df, daily_df)
    hourly_df, daily_df = feature_selection(hourly_df, daily_df)
    hourly_clf, daily_clf = train_models(hourly_df, daily_df)
    save_models(hourly_clf, daily_clf)


train_forecasting_models()
