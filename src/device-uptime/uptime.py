from datetime import datetime, timedelta

import pandas as pd
from google.cloud import bigquery

from config import Config
from models import UptimeData


def date_to_str(date, str_format="%Y-%m-%dT%H:%M:%S.%fZ"):
    return datetime.strftime(date, str_format)


class UptimeModel:
    def __init__(
        self,
        date_time: datetime,
        hourly_threshold: int,
    ):
        self.__client = bigquery.Client()
        self.__raw_data_table = f"`{Config.BIGQUERY_RAW_DATA}`"
        self.__uptime_data_table = Config.BIGQUERY_DEVICE_UPTIME_TABLE

        self.__hourly_threshold = int(hourly_threshold)
        self.__date_time = date_time

    def compute_uptime(self, data: pd.DataFrame) -> list[UptimeData]:
        devices_uptime: list[UptimeData] = []
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data.drop_duplicates(subset=["device", "timestamp"], inplace=True)
        data.index = data["timestamp"]

        for _, by_site in data.groupby("site_id"):
            site_id = by_site.iloc[0]["site_id"]

            for _, by_device in by_site.groupby("device"):
                device = by_device.iloc[0]["device"]

                for _, by_timestamp in by_device.groupby(
                    pd.Grouper(key="timestamp", freq="H")
                ):
                    device_data = pd.DataFrame(by_timestamp)

                    if len(device_data) == 0:
                        continue

                    device_data["timestamp"] = pd.to_datetime(
                        device_data["timestamp"].dt.strftime("%Y-%m-%dT%H:00:00Z")
                    )

                    data_points = int(len(device_data.index))
                    uptime = (data_points / self.__hourly_threshold) * 100
                    uptime = uptime if uptime <= 100 else 100
                    timestamp = device_data.iloc[0]["timestamp"]

                    device_data["battery"] = pd.to_numeric(
                        device_data["battery"], errors="coerce"
                    )
                    average_battery = device_data["battery"].mean()

                    device_uptime = UptimeData(
                        site_id=site_id,
                        device=device,
                        data_points=data_points,
                        uptime=uptime,
                        downtime=100 - uptime,
                        average_battery=average_battery,
                        timestamp=timestamp,
                        hourly_threshold=self.__hourly_threshold,
                    )
                    devices_uptime.append(device_uptime)

        return devices_uptime

    def save_uptime(self, data: list[UptimeData]):
        schema = [
            bigquery.SchemaField("device", "STRING"),
            bigquery.SchemaField("site_id", "STRING"),
            bigquery.SchemaField("timestamp", "TIMESTAMP"),
            bigquery.SchemaField("hourly_threshold", "INTEGER"),
            bigquery.SchemaField("data_points", "INTEGER"),
            bigquery.SchemaField("uptime", "FLOAT"),
            bigquery.SchemaField("downtime", "FLOAT"),
            bigquery.SchemaField("average_battery", "FLOAT"),
        ]
        data = [row.to_dict() for row in data]
        dataframe = pd.DataFrame(data)

        job_config = bigquery.LoadJobConfig(schema=schema)
        job = bigquery.Client().load_table_from_dataframe(
            dataframe=dataframe,
            destination=self.__uptime_data_table,
            job_config=job_config,
        )
        job.result()

    def get_raw_data(self) -> pd.DataFrame:
        query = (
            f" SELECT timestamp, site_id, device_id as device, battery "
            f" FROM {self.__raw_data_table} "
            f" WHERE {self.__raw_data_table}.timestamp >= '{date_to_str(self.__date_time, str_format='%Y-%m-%dT00:00:00Z')}' "
            f" AND {self.__raw_data_table}.timestamp <= '{date_to_str(self.__date_time, str_format='%Y-%m-%dT11:59:59Z')}' "
            f" AND ( {self.__raw_data_table}.s1_pm2_5 is not null  "
            f" OR {self.__raw_data_table}.s2_pm2_5 is not null ) "
        )

        dataframe = (
            self.__client.query(f"select distinct * from ({query})")
            .result()
            .to_dataframe()
        )

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)

        return dataframe


if __name__ == "__main__":
    uptime_model = UptimeModel(
        hourly_threshold=Config.UPTIME_HOURLY_THRESHOLD,
        date_time=datetime.utcnow() - timedelta(days=1),
    )
    raw_data = uptime_model.get_raw_data()
    uptime_data = uptime_model.compute_uptime(raw_data)
    uptime_model.save_uptime(uptime_data)
