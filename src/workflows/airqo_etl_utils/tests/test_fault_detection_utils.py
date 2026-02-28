from pathlib import Path
from pprint import pprint
import sys

import pandas as pd
import pytest


CURRENT_DIR = Path(__file__).resolve().parent
WORKFLOWS_DIR = CURRENT_DIR.parents[1]

if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(WORKFLOWS_DIR) not in sys.path:
    sys.path.insert(0, str(WORKFLOWS_DIR))

from airqo_etl_utils.ml_utils import FaultDetectionUtils


class FakeStorage:
    artifact = None

    def save_file_object(self, bucket, obj, destination_file):
        FakeStorage.artifact = obj
        return destination_file

    def load_file_object(self, bucket, source_file, local_cache_path=None):
        if FakeStorage.artifact is None:
            raise FileNotFoundError(source_file)
        return FakeStorage.artifact


@pytest.fixture
def sample_fault_detection_df():
    timestamps = pd.date_range("2025-01-01", periods=120, freq="h", tz="UTC")
    rows = []

    for index, timestamp in enumerate(timestamps):
        rows.append(
            {
                "device_id": "healthy-device",
                "timestamp": timestamp,
                "s1_pm2_5": 20 + (index % 5),
                "s2_pm2_5": 21 + (index % 5),
                "battery": 4.1,
            }
        )

    for index, timestamp in enumerate(timestamps):
        if index < 40:
            s1_value = 25
            s2_value = 90
        elif index < 80:
            s1_value = -5
            s2_value = 12
        else:
            s1_value = 1500
            s2_value = 10

        rows.append(
            {
                "device_id": "faulty-device",
                "timestamp": timestamp,
                "s1_pm2_5": s1_value,
                "s2_pm2_5": s2_value,
                "battery": 3.0,
            }
        )

    return pd.DataFrame(rows)


def test_flag_rule_based_faults_includes_new_fault_categories(
    sample_fault_detection_df,
):
    result = FaultDetectionUtils.flag_rule_based_faults(sample_fault_detection_df)

    assert "faulty-device" in result["device_id"].tolist()
    faulty_row = result[result["device_id"] == "faulty-device"].iloc[0]
    assert faulty_row["sensor_divergence_fault"] == 1
    assert faulty_row["battery_low_fault"] == 1
    assert faulty_row["stuck_value_fault"] == 1
    assert faulty_row["negative_value_fault"] == 1
    assert faulty_row["out_of_range_fault"] == 1
    assert faulty_row["fault_types"] != ""


def test_fault_model_can_train_and_score(sample_fault_detection_df, monkeypatch):
    monkeypatch.setattr("airqo_etl_utils.ml_utils.GCSFileStorage", FakeStorage)
    monkeypatch.setattr(
        "airqo_etl_utils.ml_utils.MlflowTracker.log_run",
        lambda self, **kwargs: None,
    )

    metrics = FaultDetectionUtils.train_fault_detection_model(
        sample_fault_detection_df, min_rows=50
    )
    ml_faults = FaultDetectionUtils.flag_ml_based_faults(sample_fault_detection_df)

    assert metrics["rows_used"] >= 50
    assert 0 <= metrics["f1_score"] <= 1
    assert metrics["deployed"] is True
    assert "faulty-device" in ml_faults["device_id"].tolist()


def test_fault_model_is_not_deployed_when_candidate_is_worse(
    sample_fault_detection_df, monkeypatch
):
    monkeypatch.setattr("airqo_etl_utils.ml_utils.GCSFileStorage", FakeStorage)
    monkeypatch.setattr(
        "airqo_etl_utils.ml_utils.MlflowTracker.log_run",
        lambda self, **kwargs: None,
    )
    FakeStorage.artifact = {
        "model": "existing-model",
        "feature_columns": ["sensor_mean"],
        "metrics": {
            "f1_score": 1.1,
            "precision": 1.1,
            "recall": 1.1,
        },
    }

    metrics = FaultDetectionUtils.train_fault_detection_model(
        sample_fault_detection_df, min_rows=50
    )

    assert metrics["deployed"] is False
    assert metrics["deployment_reason"] == "candidate_not_better_than_best_historical"
    assert FakeStorage.artifact["model"] == "existing-model"


def test_flag_ml_based_faults_returns_empty_when_model_is_missing(
    sample_fault_detection_df, monkeypatch
):
    monkeypatch.setattr("airqo_etl_utils.ml_utils.GCSFileStorage", FakeStorage)
    FakeStorage.artifact = None

    ml_faults = FaultDetectionUtils.flag_ml_based_faults(sample_fault_detection_df)

    assert list(ml_faults.columns) == [
        "device_id",
        "ml_fault_probability",
        "ml_fault",
    ]
    assert ml_faults.empty


def run_weekly_fault_detection():
    return FaultDetectionUtils.run_weekly_fault_detection()


def run_weekly_fault_model_training():
    return FaultDetectionUtils.run_weekly_fault_model_training()


if __name__ == "__main__":
    command = sys.argv[1].strip().lower() if len(sys.argv) > 1 else "detect"

    if command == "detect":
        output = run_weekly_fault_detection()
    elif command == "train":
        output = run_weekly_fault_model_training()
    else:
        raise SystemExit(
            "Usage: python test_fault_detection_utils.py [detect|train]"
        )

    pprint(output)
