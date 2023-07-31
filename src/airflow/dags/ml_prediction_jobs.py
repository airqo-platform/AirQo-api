from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.ml_utils import ForecastUtils

dag(
    'AirQo-forecasting-job',
    schedule='0 1 * * *',
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=['airqo', 'hourly-forecast', 'daily-forecast', 'prediction-job']
)


def make_forecasts():
    @task()
    def get_forecast_data():
        return BigQueryApi().fetch_forecast_data()

    @task()
    def preprocess_data(hourly_df, daily_df):
        return ForecastUtils.preprocess_forecast_data(hourly_df, daily_df)

    @task()
    def get_lag_features(hourly_df, daily_df):
        return ForecastUtils.get_lag_features(hourly_df, daily_df, 'pm2_5')

    @task()
    def get_other_features(hourly_df, daily_df):
        return ForecastUtils.get_other_features(hourly_df, daily_df)

    @task()
    def make_forecasts(hourly_df, daily_df):
        return ForecastUtils.get_df_forecasts(hourly_df, daily_df)

    @task()
    def save_forecasts_to_bq(hourly_df, daily_df):
        BigQueryApi().save_forecasts_to_bigquery(hourly_df, daily_df)

    @task()
    def
