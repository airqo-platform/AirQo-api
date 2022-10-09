import pandas as pd

from .airqo_api import AirQoApi
from .constants import Tenant
from .data_validator import DataValidationUtils
from .weather_data_utils import WeatherDataUtils


class MetaDataUtils:
    @staticmethod
    def extract_meta_data(component: str, tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        airqo_api = AirQoApi()

        if component == "sites":
            sites = airqo_api.get_sites(tenant=tenant)
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

        elif component == "devices":
            devices = airqo_api.get_devices(tenant=tenant)
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

        else:
            raise Exception("Invalid component. Valid values are sites and devices.")

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
