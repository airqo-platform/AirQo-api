from enum import Enum
from typing import Any, List, Union, Dict

import pandas as pd

from api.utils.dates import str_to_aqcsv_date_format
from api.utils.pollutants.pm_25 import (
    AQCSV_PARAMETER_MAPPER,
    FREQUENCY_MAPPER,
    AQCSV_UNIT_MAPPER,
    AQCSV_QC_CODE_MAPPER,
    BQ_FREQUENCY_MAPPER,
    AQCSV_DATA_STATUS_MAPPER,
)
from api.schemas.requests import _FILTER_KEYS
from api.utils.http import AirQoRequests
from api.utils.messages import FILTER_MSG
from constants import Frequency

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


def compute_entity_summary(data: pd.DataFrame, start_date_time, end_date_time) -> dict:
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


def format_to_aqcsv(
    data: List, pollutants: List, frequency: Frequency
) -> Union[List[Any], List[Dict]]:
    # Compulsory fields : site, datetime, parameter, duration, value, unit, qc, poc, data_status,
    # Optional fields : lat, lon,

    # Normalise to the plain string value once: FREQUENCY_MAPPER/BQ_FREQUENCY_MAPPER
    # are keyed by string, and `Frequency` (a plain Enum, not str-Enum) never
    # compares equal to a string, so both dict lookups and the qc branch below
    # must operate on this normalised value rather than the enum member itself.
    frequency_value = frequency.value if isinstance(frequency, Frequency) else frequency

    pollutant_mappers = BQ_FREQUENCY_MAPPER.get(frequency_value)

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

    dataframe["duration"] = FREQUENCY_MAPPER[frequency_value]
    dataframe["poc"] = 1
    dataframe["qc"] = (
        AQCSV_QC_CODE_MAPPER["averaged"]
        if frequency_value != "raw"
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
                "network",
                "device_latitude",
                "device_longitude",
                "frequency",
            ]
            if col in dataframe.columns
        ],
        inplace=True,
    )

    return dataframe.to_dict("records")


def filter_non_private_sites_devices(
    filter_type: str, filter_value: List[str]
) -> Dict[str, Any]:
    """
    Filters out private device/site IDs from a provided array of device IDs.

    Args:
        filter_type(str): A string either devices or sites.
        filter_value(List[str]): List of device/site ids to filter against.

    Returns:
        A response dictionary object that contains a list of non-private device/site ids if any.
    """

    if len(filter_value) == 0:
        raise ValueError(f"{filter_type} can't be empty")

    endpoint_base = "devices/cohorts/filterNonPrivateDevices"
    endpoint: Dict[str, str] = {
        "devices": endpoint_base,
        "device_ids": endpoint_base,
        "device_names": endpoint_base,
        "sites": "devices/grids/filterNonPrivateSites",
    }

    try:
        airqo_requests = AirQoRequests()
        response = airqo_requests.request(
            endpoint=endpoint.get(filter_type),
            body={filter_type: filter_value},
            method="post",
        )
        if response and response.get("status") == "success":
            data_type = "sites" if filter_type == "sites" else "devices"
            return airqo_requests.create_response(
                message="Successfully returned data.",
                data=response.get("data", {}).get(data_type, []),
                success=True,
            )
        else:
            return airqo_requests.create_response(response, success=False)
    except Exception as e:
        logger.exception(f"Error while filtering non private {filter_type}: {e}")


def get_validated_filter(json_data: Dict[str, Any]) -> tuple[Any, List[Any]]:
    """
    Validates that exactly one of 'sites', 'device_ids', 'device_names' or
    'grid_ids' is provided in the request.

    Args:
        json_data (dict): JSON payload from the request.

    Returns:
        tuple: The name of the filter ("sites", "device_ids", "device_names"
        or "grid_ids") and its validated value if valid.

    Note: Assurance of exactly one filter is provided is enforced by the request schema, so
    this function only needs to validate that the provided filter is recognized and return it.
    """
    filter_type: str = None
    validated_data: List[str] = None

    provided_filters = [key for key in _FILTER_KEYS if json_data.get(key)]
    if not provided_filters:
        return None, []

    filter_type = provided_filters[0]
    validated_data = json_data.get(filter_type, [])

    return filter_type, validated_data
