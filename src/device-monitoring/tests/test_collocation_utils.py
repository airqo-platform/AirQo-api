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
        devices=["x", "y"],
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


def generate_dumpy_data(device_name: str, num_rows, start_time, end_time):
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

    num_of_y_device_rows = int(
        no_of_hours * collocation_batch.data_completeness_threshold
    )
    num_of_x_device_rows = no_of_hours - num_of_y_device_rows

    data = {
        "x": generate_dumpy_data(
            "x",
            num_of_x_device_rows,
            start_time=collocation_batch.start_date,
            end_time=collocation_batch.end_date,
        ),
        "y": generate_dumpy_data(
            "y",
            num_of_y_device_rows,
            start_time=collocation_batch.start_date,
            end_time=collocation_batch.end_date,
        ),
    }

    result = compute_data_completeness_using_hourly_records(
        collocation_batch=collocation_batch,
        data=data,
    )
    assert isinstance(result, DataCompletenessResult)
    assert result.passed_devices == ["y"]
    assert result.failed_devices == ["x"]
    assert result.error_devices == []
    assert len(result.results) == 2

    for result in result.results:
        num_of_device_rows = (
            num_of_x_device_rows if result.device_name == "x" else num_of_y_device_rows
        )
        assert round(num_of_device_rows / no_of_hours, 2) >= result.completeness
        assert (
            round((no_of_hours - num_of_device_rows) / no_of_hours, 2) >= result.missing
        )
        assert result.actual == num_of_device_rows
        assert result.expected == no_of_hours

        if result.completeness >= collocation_batch.data_completeness_threshold:
            assert result.passed is True
        else:
            assert result.passed is False
