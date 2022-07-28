import pandas as pd

from airqo_api import AirQoApi
from commons import format_dataframe_column_type
from constants import DataType


def extract_meta_data(component: str, tenant=None) -> pd.DataFrame:
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

    dataframe = format_dataframe_column_type(
        dataframe=dataframe,
        data_type=DataType.FLOAT,
        columns=numeric_columns,
    )
    dataframe = format_dataframe_column_type(
        dataframe=dataframe,
        data_type=DataType.TIMESTAMP_STR,
        columns=date_time_columns,
    )
    dataframe.rename(columns=rename_columns, inplace=True)
    dataframe.reset_index(drop=True, inplace=True)
    return dataframe
