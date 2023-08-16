import uuid
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from helpers.collocation_utils import compute_data_completeness_using_hourly_records
from models.collocation import (
    CollocationBatch,
    CollocationBatchStatus,
    CollocationBatchResult,
    DataCompletenessResult,
)


@pytest.fixture
def collocation_batch():
    from config.constants import CollocationDefaults
    from helpers.convert_dates import str_to_date

    end_date_str = datetime.utcnow().strftime("%Y-%m-%d")
    end_date = str_to_date(end_date_str, str_format="%Y-%m-%d")
    start_date = end_date - timedelta(days=7)

    return CollocationBatch(
        batch_id="",
        batch_name=str(str(uuid.uuid4()).replace("-", "")[:8]).upper(),
        devices=["x", "y", "z"],
        base_device="",
        start_date=start_date,
        end_date=end_date,
        date_created=datetime.utcnow(),
        expected_hourly_records=CollocationDefaults.ExpectedRecordsPerHour,
        inter_correlation_threshold=CollocationDefaults.InterCorrelationThreshold,
        intra_correlation_threshold=CollocationDefaults.IntraCorrelationThreshold,
        inter_correlation_r2_threshold=CollocationDefaults.InterCorrelationR2Threshold,
        intra_correlation_r2_threshold=CollocationDefaults.IntraCorrelationR2Threshold,
        data_completeness_threshold=CollocationDefaults.DataCompletenessThreshold,
        differences_threshold=CollocationDefaults.DifferencesThreshold,
        data_completeness_parameter=CollocationDefaults.DataCompletenessParameter,
        inter_correlation_parameter=CollocationDefaults.InterCorrelationParameter,
        intra_correlation_parameter=CollocationDefaults.IntraCorrelationParameter,
        differences_parameter=CollocationDefaults.DifferencesParameter,
        inter_correlation_additional_parameters=CollocationDefaults.InterCorrelationAdditionalParameters,
        created_by={},
        status=CollocationBatchStatus.SCHEDULED,
        results=CollocationBatchResult.empty_results(),
        errors=[],
    )


def generate_test_data(device_name: str, num_rows, start_time, end_time):
    data = {
        "pm2_5": np.random.uniform(20, 100, num_rows),
        "pm10": np.random.uniform(20, 100, num_rows),
        "s1_pm2_5": np.random.uniform(20, 100, num_rows),
        "s2_pm2_5": np.random.uniform(20, 100, num_rows),
        "s1_pm10": np.random.uniform(20, 100, num_rows),
        "s2_pm10": np.random.uniform(20, 100, num_rows),
        "internal_temperature": np.random.uniform(20, 100, num_rows),
        "internal_humidity": np.random.uniform(20, 100, num_rows),
        "external_humidity": np.random.uniform(20, 100, num_rows),
        "external_temperature": np.random.uniform(20, 100, num_rows),
        "battery_voltage": np.random.uniform(20, 100, num_rows),
    }

    random_hours = pd.date_range(start=start_time, end=end_time, freq="H")
    random_hours = np.random.choice(random_hours, num_rows, replace=False)

    df = pd.DataFrame(data, index=random_hours)
    df["device_name"] = device_name

    df = df.reset_index().rename(columns={"index": "timestamp"})
    return df


def test_compute_data_completeness_using_hourly_data(collocation_batch):
    no_of_hours = (collocation_batch.end_date - collocation_batch.start_date).days * 24

    meta_data = {
        "x": {},
        "y": {
            "record_count": int(
                no_of_hours * (collocation_batch.data_completeness_threshold / 100)
            ),
        },
        "z": {"record_count": 0},
    }
    meta_data["x"]["record_count"] = no_of_hours - meta_data["y"]["record_count"]

    meta_data["x"]["completeness"] = (
        round(meta_data["x"]["record_count"] / no_of_hours, 2) * 100
    )
    meta_data["y"]["completeness"] = (
        round(meta_data["y"]["record_count"] / no_of_hours, 2) * 100
    )
    meta_data["z"]["completeness"] = (
        round(meta_data["z"]["record_count"] / no_of_hours, 2) * 100
    )

    meta_data["x"]["missing"] = 100 - meta_data["x"]["completeness"]
    meta_data["y"]["missing"] = 100 - meta_data["y"]["completeness"]
    meta_data["z"]["missing"] = 100 - meta_data["z"]["completeness"]

    data = {
        "x": generate_test_data(
            "x",
            meta_data["x"]["record_count"],
            start_time=collocation_batch.start_date,
            end_time=collocation_batch.end_date,
        ),
        "y": generate_test_data(
            "y",
            meta_data["y"]["record_count"],
            start_time=collocation_batch.start_date,
            end_time=collocation_batch.end_date,
        ),
        "z": generate_test_data(
            "z",
            meta_data["z"]["record_count"],
            start_time=collocation_batch.start_date,
            end_time=collocation_batch.end_date,
        ),
    }

    assert list(data.keys()) == collocation_batch.devices

    result = compute_data_completeness_using_hourly_records(
        collocation_batch=collocation_batch,
        data=data,
    )
    assert isinstance(result, DataCompletenessResult)
    assert result.passed_devices == ["y"]
    assert result.failed_devices == ["x", "z"]
    assert result.error_devices == []
    assert len(result.results) == 3

    for result in result.results:
        assert meta_data[result.device_name]["completeness"] == result.completeness
        assert meta_data[result.device_name]["missing"] == result.missing
        assert result.actual == meta_data[result.device_name]["record_count"]
        assert result.expected == no_of_hours
        passed = (
            True
            if result.completeness >= collocation_batch.data_completeness_threshold
            else False
        )
        assert result.passed is passed


def test_data_completeness_threshold(collocation_batch):
    collocation_batch.data_completeness_threshold = 0
    validate_data_completeness = collocation_batch.validate(raise_exception=False)
    assert validate_data_completeness is False

    collocation_batch.data_completeness_threshold = 1
    validate_data_completeness = collocation_batch.validate(raise_exception=False)
    assert validate_data_completeness is True

    collocation_batch.data_completeness_threshold = 100
    validate_data_completeness = collocation_batch.validate(raise_exception=False)
    assert validate_data_completeness is True

    collocation_batch.data_completeness_threshold = 101
    validate_data_completeness = collocation_batch.validate(raise_exception=False)
    assert validate_data_completeness is False


def test_inter_sensor_threshold(collocation_batch):
    collocation_batch.inter_correlation_threshold = 0
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.inter_correlation_threshold = 1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.inter_correlation_threshold = -1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False

    collocation_batch.inter_correlation_threshold = 2
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False


def test_inter_sensor_r2_threshold(collocation_batch):
    collocation_batch.inter_correlation_r2_threshold = 0
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.inter_correlation_r2_threshold = 1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.inter_correlation_r2_threshold = -1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False

    collocation_batch.inter_correlation_r2_threshold = 2
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False


def test_intra_sensor_threshold(collocation_batch):
    collocation_batch.intra_correlation_threshold = 0
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.intra_correlation_threshold = 1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.intra_correlation_threshold = -1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False

    collocation_batch.intra_correlation_threshold = 2
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False


def test_intra_sensor_r2_threshold(collocation_batch):
    collocation_batch.intra_correlation_r2_threshold = 0
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.intra_correlation_r2_threshold = 1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.intra_correlation_r2_threshold = -1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False

    collocation_batch.intra_correlation_r2_threshold = 2
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False


def test_differences_threshold(collocation_batch):
    collocation_batch.differences_threshold = 0
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.differences_threshold = 5
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is True

    collocation_batch.differences_threshold = -1
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False

    collocation_batch.differences_threshold = 6
    valid = collocation_batch.validate(raise_exception=False)
    assert valid is False
