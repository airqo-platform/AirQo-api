import pandas as pd

from .airqo_api import AirQoApi
from .bigquery_api import BigQueryApi
from .constants import Tenant
from .data_validator import DataValidationUtils
from .weather_data_utils import WeatherDataUtils


class MetaDataUtils:
    @staticmethod
    def extract_devices_from_api(tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        devices = AirQoApi().get_devices(tenant=tenant)
        dataframe = pd.json_normalize(devices)
        dataframe = dataframe[
            [
                "tenant",
                "latitude",
                "longitude",
                "site_id",
                "device_id",
                "device_number",
                "name",
                "description",
                "device_manufacturer",
                "device_category",
                "approximate_latitude",
                "approximate_longitude",
            ]
        ]

        dataframe = DataValidationUtils.remove_outliers(dataframe)

        return dataframe

    @staticmethod
    def extract_airqlouds_from_api(tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        airqlouds = AirQoApi().get_airqlouds(tenant=tenant)
        airqlouds = [
            {**airqloud, **{"sites": ",".join(map(str, airqloud.get("sites", [""])))}}
            for airqloud in airqlouds
        ]

        return pd.DataFrame(airqlouds)

    @staticmethod
    def merge_airqlouds_and_sites(data: pd.DataFrame) -> pd.DataFrame:
        merged_data = []
        data = data.dropna(subset=["sites", "id"])

        for _, row in data.iterrows():
            merged_data.extend(
                [
                    {
                        **{"airqloud_id": row["id"], "tenant": row["tenant"]},
                        **{"site_id": site},
                    }
                    for site in row["sites"].split(",")
                ]
            )

        return pd.DataFrame(merged_data)

    @staticmethod
    def extract_sites_from_api(tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        sites = AirQoApi().get_sites(tenant=tenant)
        dataframe = pd.json_normalize(sites)
        dataframe = dataframe[
            [
                "tenant",
                "site_id",
                "latitude",
                "longitude",
                "approximate_latitude",
                "approximate_longitude",
                "name",
                "location",
                "search_name",
                "location_name",
                "description",
                "city",
                "region",
                "country",
            ]
        ]

        dataframe.rename(
            columns={
                "search_name": "display_name",
                "site_id": "id",
                "location_name": "display_location",
            },
            inplace=True,
        )

        dataframe = DataValidationUtils.remove_outliers(dataframe)

        return dataframe

    @staticmethod
    def extract_sites_meta_data_from_api(tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        sites = AirQoApi().get_sites(tenant=tenant)
        dataframe = pd.json_normalize(sites)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.sites_meta_data_table)
        dataframe = DataValidationUtils.fill_missing_columns(data=dataframe, cols=cols)
        dataframe = dataframe[cols]
        dataframe = DataValidationUtils.remove_outliers(dataframe)

        return dataframe

    @staticmethod
    def update_nearest_weather_stations(tenant: Tenant) -> None:
        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant=tenant)
        sites_data = [
            {
                "site_id": site.get("site_id", None),
                "tenant": site.get("tenant", None),
                "latitude": site.get("latitude", None),
                "longitude": site.get("longitude", None),
            }
            for site in sites
        ]

        updated_sites = WeatherDataUtils.get_nearest_weather_stations(sites_data)
        updated_sites = [
            {
                "site_id": site.get("site_id"),
                "tenant": site.get("tenant"),
                "weather_stations": site.get("weather_stations"),
            }
            for site in updated_sites
        ]
        airqo_api.update_sites(updated_sites)

    @staticmethod
    def update_sites_distance_measures(tenant: Tenant) -> None:
        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant=tenant)
        updated_sites = []
        for site in sites:
            record = {
                "site_id": site.get("site_id", None),
                "tenant": site.get("tenant", None),
                "latitude": site.get("latitude", None),
                "longitude": site.get("longitude", None),
            }
            meta_data = airqo_api.get_meta_data(
                latitude=record.get("latitude"),
                longitude=record.get("longitude"),
            )

            if len(meta_data) != 0:
                updated_sites.append(
                    {
                        **meta_data,
                        **{"site_id": record["site_id"], "tenant": record["tenant"]},
                    }
                )

        airqo_api.update_sites(updated_sites)

    @staticmethod
    def refresh_airqlouds(tenant: Tenant) -> None:
        airqo_api = AirQoApi()
        airqlouds = airqo_api.get_airqlouds(tenant=tenant)

        for airqloud in airqlouds:
            airqo_api.refresh_airqloud(airqloud_id=airqloud.get("id"))
