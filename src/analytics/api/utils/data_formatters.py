import pandas as pd

from api.utils.dates import str_to_aqcsv_date_format
from api.utils.pollutants.pm_25 import (
    AQCSV_PARAMETER_MAPPER,
    FREQUENCY_MAPPER,
    AQCSV_UNIT_MAPPER,
    AQCSV_QC_CODE_MAPPER,
    BIGQUERY_FREQUENCY_MAPPER,
)


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

    sites_hourly_records = data.groupby(["site_id", "site_name"], as_index=False)[
        "hourly_records"
    ].sum()
    sites_calibrated_records = data.groupby(["site_id", "site_name"], as_index=False)[
        "calibrated_records"
    ].sum()
    sites_uncalibrated_records = data.groupby(["site_id", "site_name"], as_index=False)[
        "uncalibrated_records"
    ].sum()

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
    airqloud = data.iloc[0]["airqloud"]
    airqloud_id = data.iloc[0]["airqloud_id"]

    return {
        "airqloud": airqloud,
        "airqloud_id": airqloud_id,
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


def format_to_aqcsv(data: list, pollutants: list, frequency: str) -> dict:
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

        dataframe["parameter"] = AQCSV_PARAMETER_MAPPER[pollutant]
        dataframe["unit"] = AQCSV_UNIT_MAPPER[pollutant]

        calibrated_value_columns = [
            column
            for column in dataframe.columns
            if column.endswith(f"{pollutant}_calibrated_value")
        ]
        dataframe.rename(
            columns={
                column: f"value_{pollutant}" for column in calibrated_value_columns
            },
            inplace=True,
        )

    dataframe = dataframe[
        [
            "datetime",
            "lat",
            "lon",
            "site_id",
            "site_name",
            "duration",
            "qc",
            "parameter",
            "unit",
            "poc",
            "value_pm2_5",
            "value_pm10",
        ]
    ]
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
