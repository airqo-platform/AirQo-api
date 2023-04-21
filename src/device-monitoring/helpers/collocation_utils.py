import math
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from helpers.convert_dates import format_date, validate_date
from models import DataCompleteness, IntraSensorCorrelation, InterSensorCorrelation


def dates_array(start_date_time: datetime, end_date_time: datetime) -> list[datetime]:
    dates: list[datetime] = []
    varying_date = format_date(start_date_time, str_format="%Y-%m-%dT%H:00:00.000Z")
    while varying_date < end_date_time:
        dates.append(varying_date)
        varying_date = varying_date + timedelta(hours=1)
    return list(set(dates))


def validate_collocation_request(
    completeness_threshold,
    correlation_threshold,
    expected_records_per_day,
    devices,
    start_date,
    end_date,
) -> dict:
    errors = {}
    try:
        if not (0 <= completeness_threshold <= 1):
            raise Exception
    except Exception:
        errors["completenessThreshold"] = f"Must be a value between 0 and 1"

    try:
        if not (0 <= correlation_threshold <= 1):
            raise Exception
    except Exception:
        errors["correlationThreshold"] = f"Must be a value between 0 and 1"

    try:
        if not (1 <= expected_records_per_day <= 24):
            raise Exception
    except Exception:
        errors["expectedRecordsPerDay"] = f"Must be a value between 1 and 24"

    try:
        if not devices or not isinstance(
            devices, list
        ):  # TODO add device restrictions e.g not more that 3 devices
            raise Exception
    except Exception:
        errors["devices"] = "Provide a list of devices"

    try:
        start_date = validate_date(start_date)
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid date formatted datetime string (%Y-%m-%d)"
        )

    try:
        end_date = validate_date(end_date)
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid date formatted datetime string (%Y-%m-%d)"
        )

    if (
        start_date > end_date
    ):  # TODO add interval restrictions e.g not more that 10 days
        errors["dates"] = "endDate must be greater or equal to the startDate"

    return errors


def device_pairs(devices: list[str]) -> list[list[str]]:
    devices = list(set(devices))
    pairs = []
    for device_x in devices:
        for device_y in devices:
            if (device_x == device_y) or ((device_y, device_x) in pairs):
                continue
            pairs.append([device_x, device_y])

    return pairs


def compute_differences() -> dict:
    return {}


def compute_inter_sensor_correlation(
    devices: list[str],
    data: dict[str, pd.DataFrame],
    threshold: float,
    parameter: str,
    base_device: str,
    other_parameters: list[str],
) -> InterSensorCorrelation:
    passed_devices: list[str] = []
    failed_devices: list[str] = []
    results: list[dict] = []

    cols = ["timestamp", parameter]
    cols.extend(other_parameters)

    if base_device is not None:
        base_device_data = data.get(base_device, pd.DataFrame())
        base_device_data = base_device_data.add_prefix(f"{base_device}_")
        base_device_data.rename(
            columns={f"{base_device_data}_timestamp": "timestamp"}, inplace=True
        )

        for device, data in data.items():
            if device == base_device:
                continue

            device_data = data.get(device, pd.DataFrame())
            device_data = device_data.add_prefix(f"{device}_")
            device_data.rename(
                columns={f"{device}_timestamp": "timestamp"}, inplace=True
            )

            device_pair_data = pd.merge(
                left=device_data,
                right=base_device_data,
                on=["timestamp"],
            )

            device_pair_correlation = {}

            for col in set(cols):
                if col == "timestamp":
                    continue

                try:
                    cols = [f"{device}_{col}", f"{base_device}_{col}"]
                    device_pair_correlation_data = (
                        device_pair_data[cols].corr().round(4)
                    )
                    device_pair_correlation_data.replace(np.nan, None, inplace=True)
                    correlation_value = device_pair_correlation_data.iloc[0][cols[1]]
                    device_pair_correlation[f"{col}_pearson"] = correlation_value
                except:
                    pass

            passed = bool(device_pair_correlation[f"{parameter}_pearson"] >= threshold)
            device_pair_correlation["passed"] = bool(
                device_pair_correlation[f"{parameter}_pearson"] >= threshold
            )
            device_pair_correlation["devices"] = [base_device, device]

            results.append(device_pair_correlation)

            if passed:
                passed_devices.append(device)
            else:
                failed_devices.append(device)

    else:
        passed_pairs: list[tuple[str, str]] = []
        pairs = device_pairs(devices)

        for device_pair in pairs:
            device_x = device_pair[0]
            device_y = device_pair[1]

            device_x_data = data.get(device_x, pd.DataFrame())
            cols.extend(device_x_data.columns.to_list())
            device_x_data = device_x_data.add_prefix(f"{device_x}_")
            device_x_data.rename(
                columns={f"{device_x}_timestamp": "timestamp"}, inplace=True
            )

            device_y_data = data.get(device_y, pd.DataFrame())
            cols.extend(device_y_data.columns.to_list())
            device_y_data = device_y_data.add_prefix(f"{device_y}_")
            device_y_data.rename(
                columns={f"{device_y}_timestamp": "timestamp"}, inplace=True
            )

            device_pair_data = pd.merge(
                left=device_x_data,
                right=device_y_data,
                on=["timestamp"],
            )

            device_pair_correlation = {}

            for col in set(cols):
                try:
                    cols = [f"{device_x}_{col}", f"{device_y}_{col}"]
                    device_pair_correlation_data = (
                        device_pair_data[cols].corr().round(4)
                    )
                    device_pair_correlation_data.replace(np.nan, None, inplace=True)
                    correlation_value = device_pair_correlation_data.iloc[0][cols[1]]
                    device_pair_correlation[f"{col}_pearson"] = correlation_value

                except:
                    pass

            passed = bool(device_pair_correlation[f"{parameter}_pearson"] >= threshold)
            device_pair_correlation["passed"] = bool(
                device_pair_correlation[f"{parameter}_pearson"] >= threshold
            )
            device_pair_correlation["devices"] = [device_x, device_y]

            results.append(device_pair_correlation)

            if passed:
                passed_pairs.append((device_x, device_y))
            else:
                failed_devices.extend([device_x, device_y])

            while len(passed_pairs) != 0:
                first_pair = passed_pairs[0]
                if len(passed_devices) == 0:
                    passed_devices = list(first_pair)

                passed_devices = list(set(passed_devices).intersection(set(first_pair)))
                passed_pairs.remove(first_pair)

    failed_devices = list(set(failed_devices).difference(set(passed_devices)))
    neutral_devices = list(
        set(devices).difference(set(passed_devices)).difference(set(failed_devices))
    )

    return InterSensorCorrelation(
        results=results,
        passed_devices=passed_devices,
        failed_devices=failed_devices,
        neutral_devices=neutral_devices,
    )


def compute_intra_sensor_correlation(
    devices: list[str], data: dict[str, pd.DataFrame], threshold: float, parameter: str
) -> list[IntraSensorCorrelation]:
    correlation: list[IntraSensorCorrelation] = []

    for device in devices:
        device_data = data.get(device, pd.DataFrame())
        if len(device_data.index) == 0:
            device_correlation = IntraSensorCorrelation(
                device_name=device,
                pm2_5_pearson=None,
                pm10_pearson=None,
                pm2_5_r2=None,
                pm10_r2=None,
                passed=False,
            )
            correlation.append(device_correlation)
            continue
        # TODO compute this step
        pm2_5_pearson = device_data[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
        pm10_pearson = device_data[["s1_pm10", "s2_pm10"]].corr().round(4)
        pm2_5_r2 = math.sqrt(pm2_5_pearson.iloc[0]["s2_pm2_5"])
        pm10_r2 = math.sqrt(pm10_pearson.iloc[0]["s2_pm10"])

        if parameter == "pm10":
            passed = pm10_pearson >= threshold
        else:
            passed = pm2_5_pearson >= threshold

        device_correlation = IntraSensorCorrelation(
            device_name=device,
            pm2_5_pearson=pm2_5_pearson,
            pm10_pearson=pm10_pearson,
            pm2_5_r2=pm2_5_r2,
            pm10_r2=pm10_r2,
            passed=passed,
        )
        correlation.append(device_correlation)

    return correlation


def compute_statistics(
    data: dict[str, pd.DataFrame], parameters: list[str]
) -> list[dict]:
    statistics = []
    for device, device_data in data.items():
        device_statistics = {}

        for col in parameters:
            col_statistics = device_data[col].describe()
            device_statistics = {
                **device_statistics,
                **{
                    f"{col}_mean": col_statistics["mean"],
                    f"{col}_std": col_statistics["std"],
                    f"{col}_min": col_statistics["min"],
                    f"{col}_max": col_statistics["max"],
                    f"{col}_25_percentile": col_statistics["25%"],
                    f"{col}_50_percentile": col_statistics["50%"],
                    f"{col}_75_percentile": col_statistics["75%"],
                },
            }

        statistics.append({**{"device_name": device}, **device_statistics})

    return statistics


def compute_data_completeness(
    data: dict[str, pd.DataFrame],
    devices: list[str],
    expected_hourly_records: int,
    parameter: str,
    start_date_time: datetime,
    end_date_time: datetime,
) -> list[DataCompleteness]:
    data = data.copy()
    dates = dates_array(start_date_time=start_date_time, end_date_time=end_date_time)
    expected_records = len(dates) * expected_hourly_records
    completeness: list[DataCompleteness] = []

    for device in devices:
        device_data = data.get(device, pd.DataFrame())

        if len(device_data.index) == 0:
            completeness.append(
                DataCompleteness(
                    device_name=device,
                    actual=len(device_data.index),
                    expected=expected_records,
                    completeness=0,
                    missing=1,
                    passed=False,
                )
            )
            continue

        device_data["timestamp"] = device_data["timestamp"].apply(
            lambda x: format_date(x, str_format="%Y-%m-%dT%H:00:00.000Z")
        )
        device_data.drop_duplicates(inplace=True, keep="first", subset=["timestamp"])
        device_data.dropna(subset=[parameter], inplace=True)

        device_hourly_list = []

        for hour in dates:
            hourly_data = device_data[device_data["timestamp"] == hour]
            hourly_completeness = (
                hourly_data[parameter].count() / expected_hourly_records
            )
            hourly_completeness = 1 if hourly_completeness > 1 else hourly_completeness
            device_hourly_list.append(hourly_completeness)

        device_completeness = sum(device_hourly_list) / len(device_hourly_list)
        completeness.append(
            DataCompleteness(
                device_name=device,
                actual=len(device_data.index),
                expected=expected_records,
                completeness=device_completeness,
                missing=1 - device_completeness,
                passed=bool(device_completeness >= expected_records),
            )
        )

    return completeness
