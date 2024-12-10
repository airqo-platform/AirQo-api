from enum import Enum
from typing import Any, List, Union, Dict
from werkzeug.exceptions import BadRequest

import pandas as pd
import requests

from api.utils.dates import str_to_aqcsv_date_format
from api.utils.pollutants.pm_25 import (
    AQCSV_PARAMETER_MAPPER,
    FREQUENCY_MAPPER,
    AQCSV_UNIT_MAPPER,
    AQCSV_QC_CODE_MAPPER,
    BIGQUERY_FREQUENCY_MAPPER,
    AQCSV_DATA_STATUS_MAPPER,
)
from api.utils.http import AirQoRequests

import logging

logger = logging.getLogger(__name__)


class Entity(Enum):
    DEVICES = "devices"
    SITES = "sites"


def compute_devices_summary(data: pd.DataFrame) -> pd.DataFrame:
    devices_summary = pd.DataFrame()
    data["timestamp"] = pd.to_datetime(data["timestamp"])
    data.drop_duplicates(subset=["device", "timestamp"], inplace=True)
    data.index = data["timestamp"]

    for _, by_device in data.groupby("device"):
        for _, by_timestamp in by_device.groupby(pd.Grouper(key="timestamp", freq="D")):
            device_data = pd.DataFrame(by_timestamp)
            device_data["timestamp"] = pd.to_datetime(
                device_data["timestamp"].dt.strftime("%Y-%m-%d")
            )
            device_data["hourly_records"] = int(len(device_data.index))
            device_data["calibrated_records"] = int(
                device_data.pm2_5_calibrated_value.count()
            )
            device_data["uncalibrated_records"] = int(
                device_data.pm2_5_calibrated_value.isna().sum()
            )
            device_data["calibrated_percentage"] = (
                device_data["calibrated_records"] / device_data["hourly_records"]
            ) * 100
            device_data["uncalibrated_percentage"] = (
                device_data["uncalibrated_records"] / device_data["hourly_records"]
            ) * 100
            device_data = device_data[
                [
                    "timestamp",
                    "device",
                    "site_id",
                    "hourly_records",
                    "calibrated_records",
                    "uncalibrated_records",
                    "calibrated_percentage",
                    "uncalibrated_percentage",
                ]
            ]
            device_data["hourly_records"] = device_data["hourly_records"].astype(int)
            devices_summary = pd.concat(
                [devices_summary, device_data], ignore_index=True
            )

    return devices_summary


def compute_airqloud_summary(
    data: pd.DataFrame, start_date_time, end_date_time
) -> dict:
    if len(data.index) == 0:
        return {}

    devices = data[
        [
            "device",
            "hourly_records",
            "calibrated_records",
            "uncalibrated_records",
            "calibrated_percentage",
            "uncalibrated_percentage",
        ]
    ]
    devices = devices.to_dict("records")

    if "cohort" in data.columns:
        sites_hourly_records = data.groupby(["site_id", "site_name"], as_index=False)[
            "hourly_records"
        ].sum()
        sites_calibrated_records = data.groupby(
            ["site_id", "site_name"], as_index=False
        )["calibrated_records"].sum()
        sites_uncalibrated_records = data.groupby(
            ["site_id", "site_name"], as_index=False
        )["uncalibrated_records"].sum()

        sites = pd.merge(
            sites_hourly_records, sites_calibrated_records, on=["site_id", "site_name"]
        ).merge(sites_uncalibrated_records, on=["site_id", "site_name"])

        sites["calibrated_percentage"] = (
            sites["calibrated_records"] / sites["hourly_records"]
        ) * 100
        sites["uncalibrated_percentage"] = (
            sites["uncalibrated_records"] / sites["hourly_records"]
        ) * 100

        sites = sites.to_dict("records")

        hourly_records = int(data["hourly_records"].sum())
        calibrated_records = int(data["calibrated_records"].sum())
        un_calibrated_records = int(data["uncalibrated_records"].sum())

        cohort = data.iloc[0]["cohort"]
        cohort_id = data.iloc[0]["cohort_id"]
        return {
            "cohort": cohort,
            "cohort_id": cohort_id,
            "hourly_records": hourly_records,
            "calibrated_records": calibrated_records,
            "uncalibrated_records": un_calibrated_records,
            "calibrated_percentage": (calibrated_records / hourly_records) * 100,
            "uncalibrated_percentage": (un_calibrated_records / hourly_records) * 100,
            "start_date_time": start_date_time,
            "end_date_time": end_date_time,
            "sites": sites,
            "devices": devices,
        }

    else:
        sites_hourly_records = data.groupby(["site_id", "site_name"], as_index=False)[
            "hourly_records"
        ].sum()
        sites_calibrated_records = data.groupby(
            ["site_id", "site_name"], as_index=False
        )["calibrated_records"].sum()
        sites_uncalibrated_records = data.groupby(
            ["site_id", "site_name"], as_index=False
        )["uncalibrated_records"].sum()

        sites = pd.merge(
            sites_hourly_records, sites_calibrated_records, on=["site_id", "site_name"]
        ).merge(sites_uncalibrated_records, on=["site_id", "site_name"])

        sites["calibrated_percentage"] = (
            sites["calibrated_records"] / sites["hourly_records"]
        ) * 100
        sites["uncalibrated_percentage"] = (
            sites["uncalibrated_records"] / sites["hourly_records"]
        ) * 100

        sites = sites.to_dict("records")

        hourly_records = int(data["hourly_records"].sum())
        calibrated_records = int(data["calibrated_records"].sum())
        un_calibrated_records = int(data["uncalibrated_records"].sum())

        if "grid" in data.columns:
            grid = data.iloc[0]["grid"]
            grid_id = data.iloc[0]["grid_id"]
            return {
                "grid": grid,
                "grid_id": grid_id,
                "hourly_records": hourly_records,
                "calibrated_records": calibrated_records,
                "uncalibrated_records": un_calibrated_records,
                "calibrated_percentage": (calibrated_records / hourly_records) * 100,
                "uncalibrated_percentage": (un_calibrated_records / hourly_records)
                * 100,
                "start_date_time": start_date_time,
                "end_date_time": end_date_time,
                "sites": sites,
                "devices": devices,
            }

        elif "airqloud" in data.columns:
            airqloud = data.iloc[0]["airqloud"]
            airqloud_id = data.iloc[0]["airqloud_id"]
            return {
                "airqloud": airqloud,
                "airqloud_id": airqloud_id,
                "hourly_records": hourly_records,
                "calibrated_records": calibrated_records,
                "uncalibrated_records": un_calibrated_records,
                "calibrated_percentage": (calibrated_records / hourly_records) * 100,
                "uncalibrated_percentage": (un_calibrated_records / hourly_records)
                * 100,
                "start_date_time": start_date_time,
                "end_date_time": end_date_time,
                "sites": sites,
                "devices": devices,
            }


def format_to_aqcsv(
    data: List, pollutants: List, frequency: str
) -> Union[List[Any], List[Dict]]:
    # Compulsory fields : site, datetime, parameter, duration, value, unit, qc, poc, data_status,
    # Optional fields : lat, lon,

    pollutant_mappers = BIGQUERY_FREQUENCY_MAPPER.get(frequency)

    dataframe = pd.DataFrame(data)
    if dataframe.empty:
        return []
    dataframe.rename(
        columns={
            "timestamp": "datetime",
            "site_latitude": "lat",
            "site_longitude": "lon",
        },
        inplace=True,
    )

    dataframe["duration"] = FREQUENCY_MAPPER[frequency]
    dataframe["poc"] = 1
    dataframe["qc"] = (
        AQCSV_QC_CODE_MAPPER["averaged"]
        if frequency != "raw"
        else AQCSV_QC_CODE_MAPPER["estimated"]
    )
    dataframe["datetime"] = dataframe["datetime"].apply(str_to_aqcsv_date_format)

    for pollutant in pollutants:
        if pollutant not in pollutant_mappers.keys():
            continue

        dataframe[f"parameter_{pollutant}"] = AQCSV_PARAMETER_MAPPER[pollutant]
        dataframe[f"unit_{pollutant}"] = AQCSV_UNIT_MAPPER[pollutant]
        dataframe.rename(
            columns={
                column: f"value_{pollutant}"
                for column in dataframe.columns
                if column.endswith(f"{pollutant}_calibrated_value")
            },
            inplace=True,
        )
        dataframe[f"data_status_{pollutant}"] = AQCSV_DATA_STATUS_MAPPER[
            f"{pollutant}_calibrated_value"
        ]

    dataframe.drop(
        columns=[
            col
            for col in [
                "pm2_5_raw_value",
                "pm10_raw_value",
                "device_name",
                "tenant",
                "device_latitude",
                "device_longitude",
                "frequency",
            ]
            if col in dataframe.columns
        ],
        inplace=True,
    )

    return dataframe.to_dict("records")


def tenant_to_str(tenant: str) -> str:
    try:
        if tenant.lower() == "airqo":
            return "AirQo"
        elif tenant.lower() == "kcca":
            return "KCCA"
        elif tenant.lower() == "us_embassy":
            return "US Embassy"
        else:
            pass
    except Exception as ex:
        pass

    return ""


def device_category_to_str(device_category: str) -> str:
    try:
        if device_category.lower() == "bam":
            return "Reference Monitor"
        elif device_category.lower() == "lowcost":
            return "Low Cost Sensor"
        else:
            pass
    except Exception as ex:
        pass

    return ""


def filter_non_private_sites(filter_type: str, sites: List[str]) -> Dict[str, Any]:
    """
    Filters out private site IDs from a provided array of site IDs.

    Args:
        sites(List[str]): List of site ids to filter against.

    Returns:
        a response dictionary object that contains a list of non-private site ids if any.
    """

    if len(sites) == 0:
        return {}

    endpoint: str = "devices/grids/filterNonPrivateSites"

    try:
        airqo_requests = AirQoRequests()
        response = airqo_requests.request(
            endpoint=endpoint, body={filter_type: sites}, method="post"
        )
        if response and response.get("status") == "success":
            return airqo_requests.create_response(
                message="Successfully returned data.",
                data=response.get("data"),
                success=True,
            )
        else:
            return airqo_requests.create_response(response, success=False)
    except Exception as rex:
        logger.exception(f"Error while filtering non private devices {rex}")


def validate_network(self, network_name: str) -> bool:
    """
    Validate if a given network name exists in the list of networks.

    Args:
        network_name (str): The name of the network to validate.

    Returns:
        bool: True if the network name exists, False otherwise.
    """
    if not network_name:
        return False

    endpoint: str = "/users/networks"
    airqo_requests = AirQoRequests()
    response = airqo_requests.request(endpoint=endpoint, method="get")

    if response and "networks" in response:
        networks = response["networks"]
        # TODO Could add an active network filter
        return any(network.get("net_name") == network_name for network in networks)

    return False


def filter_non_private_devices(filter_type: str, devices: List[str]) -> Dict[str, Any]:
    """
    FilterS out private device IDs from a provided array of device IDs.

    Args:
        entities(List[str]): List of device/site ids to filter against.

    Returns:
        a response dictionary object that contains a list of non-private device ids if any.
    """

    if len(devices) == 0:
        return {}

    endpoint: str = "devices/cohorts/filterNonPrivateDevices"
    try:
        airqo_requests = AirQoRequests()
        response = airqo_requests.request(
            endpoint=endpoint, body={filter_type: devices}, method="post"
        )
        if response and response.get("status") == "success":
            return airqo_requests.create_response(
                message="Successfully returned data.",
                data=response.get("data"),
                success=True,
            )
        else:
            return airqo_requests.create_response(response, success=False)
    except Exception as rex:
        logger.exception(f"Error while filtering non private devices {rex}")
