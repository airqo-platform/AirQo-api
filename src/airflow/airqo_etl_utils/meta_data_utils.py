import pandas as pd

from .airqo_api import AirQoApi
from .constants import ColumnDataType, Tenant
from .utils import Utils
from .weather_data_utils import WeatherDataUtils


class MetaDataUtils:
    @staticmethod
    def extract_meta_data(component: str, tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
        airqo_api = AirQoApi()
        if component == "sites":
            meta_data = airqo_api.get_sites(tenant=tenant)
        elif component == "devices":
            meta_data = airqo_api.get_devices(tenant=tenant)
        else:
            raise Exception("Invalid component. Valid values are sites and devices.")

        dataframe = pd.json_normalize(meta_data)

        date_time_columns = []

        if component == "sites":

            dataframe = dataframe[
                [
                    "_id",
                    "latitude",
                    "tenant",
                    "longitude",
                    "approximate_latitude",
                    "approximate_longitude",
                    "generated_name",
                    "name",
                    "bearing_to_kampala_center",
                    "landform_90",
                    "distance_to_kampala_center",
                    "altitude",
                    "landform_270",
                    "aspect",
                    "description",
                    "distance_to_nearest_tertiary_road",
                    "distance_to_nearest_primary_road",
                    "distance_to_nearest_road",
                    "distance_to_nearest_residential_road",
                    "distance_to_nearest_secondary_road",
                    "distance_to_nearest_unclassified_road",
                    "country",
                    "region",
                    "parish",
                    "sub_county",
                    "county",
                    "district",
                    "city",
                ]
            ]

            numeric_columns = [
                "latitude",
                "longitude",
                "approximate_latitude",
                "approximate_longitude",
                "bearing_to_kampala_center",
                "landform_90",
                "distance_to_kampala_center",
                "altitude",
                "landform_270",
                "aspect",
                "distance_to_nearest_tertiary_road",
                "distance_to_nearest_primary_road",
                "distance_to_nearest_road",
                "distance_to_nearest_residential_road",
                "distance_to_nearest_secondary_road",
                "distance_to_nearest_unclassified_road",
            ]
            rename_columns = {
                "_id": "id",
            }

        elif component == "devices":

            dataframe = dataframe[
                [
                    "_id",
                    "tenant",
                    "visibility",
                    "mobility",
                    "height",
                    "isPrimaryInLocation",
                    "nextMaintenance",
                    "isActive",
                    "device_number",
                    "long_name",
                    "description",
                    "createdAt",
                    "writeKey",
                    "readKey",
                    "phoneNumber",
                    "name",
                    "deployment_date",
                    "maintenance_date",
                    "recall_date",
                    "latitude",
                    "longitude",
                    "mountType",
                    "powerType",
                    "site._id",
                ]
            ]
            numeric_columns = [
                "latitude",
                "longitude",
                "device_number",
                "height",
            ]
            date_time_columns = [
                "recall_date",
                "maintenance_date",
                "deployment_date",
                "createdAt",
                "nextMaintenance",
            ]
            rename_columns = {
                "site._id": "site_id",
                "_id": "id",
                "isPrimaryInLocation": "primary",
                "nextMaintenance": "next_maintenance",
                "phoneNumber": "phone_number",
                "writeKey": "write_key",
                "readKey": "read_key",
                "isActive": "active",
                "createdAt": "created_on",
                "mountType": "mount_type",
                "powerType": "power_type",
            }

        else:
            raise Exception("Invalid component. Valid values are sites and devices.")

        dataframe = Utils.format_dataframe_column_type(
            dataframe=dataframe,
            data_type=ColumnDataType.FLOAT,
            columns=numeric_columns,
        )
        dataframe = Utils.format_dataframe_column_type(
            dataframe=dataframe,
            data_type=ColumnDataType.TIMESTAMP_STR,
            columns=date_time_columns,
        )
        dataframe.rename(columns=rename_columns, inplace=True)
        dataframe.reset_index(drop=True, inplace=True)
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
