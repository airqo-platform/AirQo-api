"""Local runner for quarterly site forecast training.

Usage:
python src/workflows/airqo_etl_utils/tests/forecast.py
"""

from pathlib import Path
from pprint import pprint
import sys

CURRENT_DIR = Path(__file__).resolve().parent
WORKFLOWS_DIR = CURRENT_DIR.parents[1]

if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
if str(WORKFLOWS_DIR) not in sys.path:
    sys.path.insert(0, str(WORKFLOWS_DIR))

from airqo_etl_utils.ml_utils import ForecastModelTrainer

def run_site_forecast_quarterly_training():
    return ForecastModelTrainer.run_site_forecast_quarterly_training()


if __name__ == "__main__":
    output = run_site_forecast_quarterly_training()
    pprint(output)
