from typing import Union

import pandas as pd
from google.cloud import bigquery

from models import AirQloud, Site, Device, AirQloudSite


class BigQueryAPI:
    def __init__(self):
        self.client = bigquery.Client()

    def __query_records(self, table: str) -> pd.DataFrame:
        query = f"SELECT * FROM `{table}`"
        dataframe = self.client.query(query=query).result().to_dataframe()
        return dataframe

    def __update_records(self, records: pd.DataFrame, table: str):
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_TRUNCATE",
        )
        job = self.client.load_table_from_dataframe(
            records, table, job_config=job_config
        )
        job.result()
        print("Successfully updated records")

    def update(self, data: Union[AirQloud, Site, Device]):
        records = data.to_dataframe().set_index(data.id_field, drop=False)

        existing_records = self.__query_records(data.table)
        existing_records.set_index(data.id_field, inplace=True, drop=False)
        existing_records.update(records)

        new_records = records.subtract(existing_records, fill_value=0)

        records = pd.concat([new_records, existing_records], ignore_index=True)

        self.__update_records(records=records, table=data.table)

    def update_airqloud_sites(self, data: list[AirQloudSite]):
        records = pd.DataFrame([row.to_dict() for row in data])
        existing_records = self.__query_records(AirQloudSite.table)

        records = pd.concat([records, existing_records], ignore_index=True)
        records.drop_duplicates(
            inplace=True, subset=["airqloud_id", "site_id", "tenant"]
        )

        self.__update_records(records=records, table=AirQloudSite.table)
