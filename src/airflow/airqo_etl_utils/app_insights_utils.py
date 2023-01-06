import firebase_admin
import numpy as np
import pandas as pd
from firebase_admin import credentials, firestore

from .bigquery_api import BigQueryApi
from .commons import (
    get_air_quality,
)
from .config import configuration
from .constants import Tenant, Pollutant
from .data_validator import DataValidationUtils


class AirQoAppUtils:
    @staticmethod
    def update_latest_hourly_data(
        bigquery_latest_hourly_data: pd.DataFrame, tenant: Tenant
    ):
        firebase_data = AirQoAppUtils.process_for_firebase(
            data=bigquery_latest_hourly_data, tenant=tenant
        )
        AirQoAppUtils.update_firebase_air_quality_readings(firebase_data)

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

        data = data[
            [
                "pm2_5_calibrated_value",
                "pm2_5_raw_value",
                "pm10_calibrated_value",
                "pm10_raw_value",
                "tenant",
                "site_id",
                "timestamp",
                "site_latitude",
                "site_longitude",
            ]
        ]

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

        data.loc[:, "tenant"] = data["tenant"].apply(
            lambda x: Tenant.from_str(x).name()
        )

        data.rename(
            columns={
                "site_id": "referenceSite",
                "timestamp": "dateTime",
                "site_latitude": "latitude",
                "site_longitude": "longitude",
                "tenant": "source",
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

        bigquery_api = BigQueryApi()
        sites = bigquery_api.query_sites(tenant=tenant)
        sites = sites[["region", "country", "display_name", "display_location", "id"]]
        sites.rename(
            columns={
                "display_name": "name",
                "display_location": "location",
                "id": "referenceSite",
            },
            inplace=True,
        )

        data = data.merge(sites, on=["referenceSite"], how="left")

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
