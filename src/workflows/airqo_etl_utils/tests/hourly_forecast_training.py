"""Local runner for hourly device forecast training.

Usage:
python src/workflows/airqo_etl_utils/tests/hourly_forecast_training.py
"""

from pathlib import Path
from pprint import pprint
import sys

CURRENT_DIR = Path(__file__).resolve().parent
WORKFLOWS_DIR = CURRENT_DIR.parents[1]

if str(WORKFLOWS_DIR) not in sys.path:
    sys.path.insert(0, str(WORKFLOWS_DIR))

from dags.forecast_training_jobs import run_hourly_forecast_training_pipeline


def run_hourly_forecast_training():
    return run_hourly_forecast_training_pipeline()


if __name__ == "__main__":
    output = run_hourly_forecast_training()
    pprint(output)
