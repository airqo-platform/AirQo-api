import traceback
from datetime import datetime, timedelta

import firebase_admin
import numpy as np
import pandas as pd
from firebase_admin import credentials, firestore

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .commons import (
    get_air_quality,
)
from .config import configuration
from .constants import Frequency, DataSource, Tenant, Pollutant
from .data_validator import DataValidationUtils
from .date import (
    date_to_str,
    predict_str_to_date,
)
from .message_broker import KafkaBrokerClient
from .utils import Utils

insights_columns = ["time", "pm2_5", "pm10", "siteId", "frequency", "forecast", "empty"]


class AirQoAppUtils:
    @staticmethod
    def extract_hourly_airqo_data(start_date_time, end_date_time) -> pd.DataFrame:
        cols = [
            "pm2_5_raw_value",
            "pm2_5_calibrated_value",
            "pm10_raw_value",
            "pm10_calibrated_value",
            "timestamp",
            "site_id",
        ]
        bigquery_api = BigQueryApi()
        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=cols,
            table=bigquery_api.hourly_measurements_table,
            tenant=Tenant.AIRQO,
        )

        if measurements.empty:
            return pd.DataFrame([], columns=cols)

        measurements.rename(
            columns={
                "timestamp": "time",
                "site_id": "siteId",
                "pm2_5_calibrated_value": "pm2_5",
                "pm10_calibrated_value": "pm10",
            },
            inplace=True,
        )
        measurements["pm2_5"] = measurements["pm2_5"].fillna(
            measurements["pm2_5_raw_value"]
        )
        measurements["pm10"] = measurements["pm10"].fillna(
            measurements["pm10_raw_value"]
        )

        measurements["time"] = measurements["time"].apply(pd.to_datetime)
        measurements["frequency"] = str(Frequency.HOURLY)
        measurements[["forecast", "empty"]] = False

        return measurements[insights_columns]

    @staticmethod
    def format_data_to_insights(
        data: pd.DataFrame, frequency: Frequency
    ) -> pd.DataFrame:

        insights = data[["site_id", "timestamp", "pm2_5", "pm10"]]
        insights.rename(
            columns={"timestamp": "time", "site_id": "siteId"}, inplace=True
        )
        insights.loc[:, "frequency"] = frequency
        insights[["empty", "forecast"]] = False

        return AirQoAppUtils.create_insights(insights)

    @staticmethod
    def create_insights(data: pd.DataFrame) -> pd.DataFrame:

        data = data.copy()

        if data.empty:
            return pd.DataFrame(columns=insights_columns)

        data["time"] = data["time"].apply(pd.to_datetime)
        data["time"] = data["time"].apply(date_to_str)

        data["frequency"] = data["frequency"].apply(lambda x: str(x).upper())
        data["forecast"] = data["forecast"].fillna(False)
        data["empty"] = False
        data["pm2_5"] = data["pm2_5"].apply(
            lambda x: AirQoAppUtils.round_off_value(x, "pm2_5")
        )
        data["pm10"] = data["pm10"].apply(
            lambda x: AirQoAppUtils.round_off_value(x, "pm10")
        )
        if sorted(list(data.columns)) != sorted(insights_columns):
            print(f"Required columns {insights_columns}")
            print(f"Dataframe columns {list(data.columns)}")
            raise Exception("Invalid columns")

        return data.dropna()

    @staticmethod
    def save_insights(insights_data: pd.DataFrame = None, partition: int = 0):
        insights_data = (
            [] if insights_data.empty else insights_data.to_dict(orient="records")
        )

        print(f"saving {len(insights_data)} insights .... ")

        data = {
            "data": insights_data,
            "action": "",
        }

        kafka = KafkaBrokerClient()
        kafka.send_data(
            info=data,
            topic=configuration.INSIGHTS_MEASUREMENTS_TOPIC,
            partition=partition,
        )

    @staticmethod
    def extract_forecast_data() -> pd.DataFrame:
        airqo_api = AirQoApi()
        devices = airqo_api.get_devices(tenant=Tenant.AIRQO)

        forecast_measurements = pd.DataFrame(data=[], columns=insights_columns)
        time = int((datetime.utcnow() + timedelta(hours=1)).timestamp())

        for device in devices:
            device_dict = dict(device)
            device_number = device_dict.get("device_number", None)
            site = device_dict.get("site", None)
            if not site:
                print(f"device {device_number} isn't attached to  a site.")
                continue
            site_id = site["_id"]

            if device_number:

                forecast = airqo_api.get_forecast(
                    channel_id=device_number, timestamp=time
                )
                if forecast:
                    forecast_df = pd.DataFrame(forecast)

                    forecast_df.rename(
                        columns={
                            "prediction_time": "time",
                            "prediction_value": "pm2_5",
                        },
                        inplace=True,
                    )
                    forecast_df["pm10"] = forecast_df["pm2_5"]
                    forecast_df["siteId"] = site_id
                    forecast_df["frequency"] = "hourly"
                    forecast_df["forecast"] = True
                    forecast_df["empty"] = False

                    forecast_df = forecast_df[insights_columns]

                    forecast_measurements = forecast_measurements.append(
                        forecast_df, ignore_index=True
                    )

        forecast_measurements["time"] = forecast_measurements["time"].apply(
            lambda x: AirQoAppUtils.predict_time_to_string(x)
        )

        return forecast_measurements.dropna(subset=["pm2_5", "time"])

    @staticmethod
    def predict_time_to_string(time: str):
        date_time = predict_str_to_date(time)
        return date_to_str(date_time)

    @staticmethod
    def extract_insights(
        freq: str,
        start_date_time: str,
        end_date_time: str,
        forecast=False,
        all_data=False,
    ) -> pd.DataFrame:
        airqo_api = AirQoApi()
        insights = []

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRQO,
        )

        for start, end in dates:
            try:
                api_results = airqo_api.get_app_insights(
                    start_time=start,
                    frequency=freq,
                    end_time=end,
                    forecast=forecast,
                    all_data=all_data,
                )
                insights.extend(api_results)

            except Exception as ex:
                print(ex)
                traceback.print_exc()

        return pd.DataFrame(insights)

    @staticmethod
    def transform_old_forecast(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        forecast_data = AirQoAppUtils.extract_insights(
            freq="hourly",
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            forecast=True,
        )

        insights = pd.DataFrame(data=forecast_data)
        insights = insights[insights_columns]
        insights["forecast"] = False
        insights["empty"] = False
        return insights

    @staticmethod
    def average_insights(data: pd.DataFrame, frequency="daily") -> pd.DataFrame:
        if data.empty:
            return pd.DataFrame(data=[], columns=insights_columns)

        site_groups = data.groupby("siteId")
        sampled_data = pd.DataFrame()
        resample_value = "24H" if frequency.lower() == "daily" else "1H"

        for _, site_group in site_groups:
            site_id = site_group.iloc[0]["siteId"]

            insights = site_group[["time", "pm2_5", "pm10"]]
            insights["time"] = insights["time"].apply(pd.to_datetime)
            averages = pd.DataFrame(insights.resample(resample_value, on="time").mean())
            averages["time"] = averages.index
            averages.reset_index(drop=True, inplace=True)

            averages["frequency"] = frequency.upper()
            averages["siteId"] = site_id
            averages["forecast"] = False
            averages["empty"] = False

            sampled_data = sampled_data.append(averages, ignore_index=True)

        return sampled_data

    @staticmethod
    def round_off_value(value, pollutant, decimals: int = 2):
        if value is None:
            return None
        new_value = round(value, decimals)

        if get_air_quality(value, pollutant) != get_air_quality(new_value, pollutant):
            try:
                new_value = f"{value}".split(".")
                decimal_values = new_value[1][:decimals]
                return float(f"{new_value[0]}.{decimal_values}")
            except Exception as ex:
                print(ex)
            return value

        return new_value

    @staticmethod
    def process_for_firebase(data: pd.DataFrame, tenant: Tenant) -> pd.DataFrame:

        data.loc[:, "calibrated"] = np.where(
            data["pm2_5_calibrated_value"].isnull(), False, True
        )
        data.loc[:, "pm2_5_calibrated_value"] = data["pm2_5_calibrated_value"].fillna(
            data["pm2_5_raw_value"]
        )
        data.loc[:, "pm2_5_calibrated_value"] = data["pm2_5_calibrated_value"].apply(
            lambda pm2_5: AirQoAppUtils.round_off_value(pm2_5, Pollutant.PM2_5)
        )
        data["pm2_5"] = data["pm2_5_calibrated_value"]
        data.loc[:, "airQuality"] = data["pm2_5_calibrated_value"].apply(
            lambda pm2_5: str(get_air_quality(pm2_5, Pollutant.PM2_5))
        )

        data.loc[:, "pm10_calibrated_value"] = data["pm10_calibrated_value"].fillna(
            data["pm10_raw_value"]
        )
        data.loc[:, "pm10_calibrated_value"] = data["pm10_calibrated_value"].apply(
            lambda pm10: AirQoAppUtils.round_off_value(pm10, Pollutant.PM10)
        )
        data["pm10"] = data["pm10_calibrated_value"]

        data.loc[:, "source"] = data["tenant"].apply(
            lambda x: Tenant.from_str(x).name()
        )

        data.rename(
            columns={
                "site_id": "referenceSite",
                "timestamp": "dateTime",
                "site_latitude": "latitude",
                "site_longitude": "longitude",
            },
            inplace=True,
        )

        data.dropna(
            inplace=True,
            subset=[
                "pm2_5",
                "referenceSite",
                "dateTime",
                "source",
            ],
        )

        if tenant == Tenant.ALL:
            pass
        elif tenant in [Tenant.AIRQO, Tenant.KCCA]:
            sites = AirQoApi().get_sites(tenant=tenant)
            del data["latitude"]
            del data["longitude"]

            sites = [
                {
                    "referenceSite": site.get("site_id", None),
                    "name": site.get("search_name", None),
                    "location": site.get("location_name", None),
                    "region": site.get("region", None),
                    "country": site.get("country", None),
                    "latitude": site.get("latitude", None),
                    "longitude": site.get("longitude", None),
                    "site_sec_name": site.get("name", None),
                    "site_sec_location": site.get("description", None),
                }
                for site in sites
            ]

            sites = pd.DataFrame(sites)
            sites["name"] = sites["name"].fillna(sites["site_sec_name"])
            sites["location"] = sites["location"].fillna(sites["site_sec_location"])
            sites.dropna(inplace=True, subset=["referenceSite", "name", "location"])

            data = data.merge(sites, on=["referenceSite"], how="left")

        elif tenant == Tenant.US_EMBASSY:
            data["location"] = data["site_name"]
            data["country"] = data["site_name"]
            data["region"] = data["site_name"]
            data["name"] = data["site_name"]

        data = data[
            [
                "pm2_5",
                "pm10",
                "calibrated",
                "dateTime",
                "referenceSite",
                "name",
                "location",
                "latitude",
                "longitude",
                "region",
                "country",
                "source",
            ]
        ]
        data = DataValidationUtils.remove_outliers(data)

        data.loc[:, "placeId"] = data["referenceSite"]
        data.loc[:, "dateTime"] = pd.to_datetime(data["dateTime"])

        data.sort_values(ascending=True, by="dateTime", inplace=True)
        data.drop_duplicates(
            keep="first", inplace=True, subset=["referenceSite", "dateTime"]
        )

        return data

    @staticmethod
    def update_firebase_air_quality_readings(data: pd.DataFrame):
        cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        batch = db.batch()

        for _, row in data.iterrows():
            site_collection = db.collection(
                configuration.FIREBASE_AIR_QUALITY_READINGS_COLLECTION
            ).document(row["placeId"])
            batch.set(site_collection, row.to_dict())

        batch.commit()
