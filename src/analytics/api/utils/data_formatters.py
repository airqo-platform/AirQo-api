import pandas as pd

from api.utils.dates import str_to_aqcsv_date_format
from api.utils.pollutants.pm_25 import (
    POLLUTANT_BIGQUERY_MAPPER,
    AQCSV_PARAMETER_MAPPER,
    FREQUENCY_MAPPER,
    AQCSV_UNIT_MAPPER,
    AQCSV_QC_CODE_MAPPER,
    AQCSV_DATA_STATUS_MAPPER,
    BIGQUERY_FREQUENCY_MAPPER,
)


def compute_airqloud_data_statistics(
    data: pd.DataFrame, start_date_time, end_date_time
) -> dict:
    if len(data.index) == 0:
        return {}

    devices = []
    for _, by_device in data.groupby("device"):
        device_total_records = len(by_device.index)
        device_calibrated_records = int(by_device.pm2_5_calibrated_value.count())
        device_un_calibrated_records = int(
            by_device.pm2_5_calibrated_value.isna().sum()
        )
        devices.append(
            {
                "device": by_device.iloc[0]["device"],
                "hourly_records": device_total_records,
                "calibrated_records": device_calibrated_records,
                "uncalibrated_records": device_un_calibrated_records,
                "calibrated_percentage": (
                    device_calibrated_records / device_total_records
                )
                * 100,
                "uncalibrated_percentage": (
                    device_un_calibrated_records / device_total_records
                )
                * 100,
            }
        )

    sites = []

    for _, by_site in data.groupby("site_id"):
        site_total_records = len(by_site.index)
        site_calibrated_records = int(by_site.pm2_5_calibrated_value.count())
        site_un_calibrated_records = int(by_site.pm2_5_calibrated_value.isna().sum())

        sites.append(
            {
                "site_id": by_site.iloc[0]["site_id"],
                "site_name": by_site.iloc[0]["site"],
                "hourly_records": site_total_records,
                "calibrated_records": site_calibrated_records,
                "uncalibrated_records": site_un_calibrated_records,
                "calibrated_percentage": (site_calibrated_records / site_total_records)
                * 100,
                "uncalibrated_percentage": (
                    site_un_calibrated_records / site_total_records
                )
                * 100,
            }
        )

    total_records = len(data.index)
    calibrated_records = int(data.pm2_5_calibrated_value.count())
    un_calibrated_records = int(data.pm2_5_calibrated_value.isna().sum())
    airqloud = list(set(data.airqloud.to_list()))[0]

    return {
        "airqloud": airqloud,
        "hourly_records": total_records,
        "calibrated_records": calibrated_records,
        "uncalibrated_records": un_calibrated_records,
        "calibrated_percentage": (calibrated_records / total_records) * 100,
        "uncalibrated_percentage": (un_calibrated_records / total_records) * 100,
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

    aqcsv_dataframe = pd.DataFrame([])

    for pollutant in pollutants:
        if pollutant not in pollutant_mappers.keys():
            continue

        dataframe["parameter"] = AQCSV_PARAMETER_MAPPER[pollutant]
        dataframe["unit"] = AQCSV_UNIT_MAPPER[pollutant]

        pollutant_mapping = pollutant_mappers.get(pollutant, [])
        for mapping in pollutant_mapping:
            pollutant_dataframe = dataframe[
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
                    mapping,
                ]
            ]
            pollutant_dataframe.dropna(subset=[mapping], inplace=True)

            if pollutant_dataframe.empty or mapping not in AQCSV_DATA_STATUS_MAPPER.keys():
                continue

            pollutant_dataframe["data_status"] = AQCSV_DATA_STATUS_MAPPER[mapping]
            pollutant_dataframe.rename(columns={mapping: "value"}, inplace=True)
            aqcsv_dataframe = pd.concat(
                [aqcsv_dataframe, pollutant_dataframe], ignore_index=True
            )

    return aqcsv_dataframe.to_dict("records")


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
