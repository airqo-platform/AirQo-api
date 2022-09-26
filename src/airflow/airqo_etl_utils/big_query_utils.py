import pandas as pd

from .app_insights_utils import AirQoAppUtils
from .bigquery_api import BigQueryApi
from .constants import Tenant
from .data_validator import DataValidationUtils


class BigQueryUtils:
    @staticmethod
    def update_latest_measurements(data: pd.DataFrame, tenant: Tenant):
        big_query_api = BigQueryApi()
        table = big_query_api.latest_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table, tenant=tenant
        )

        big_query_api.update_data(data, table=table)

        data = AirQoAppUtils.process_for_firebase(data=data)
        AirQoAppUtils.update_firebase_air_quality_readings(data)
