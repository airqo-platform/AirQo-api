import pytest
import sys
from datetime import datetime
sys.path.append('../')
from helpers.utils import get_hourly_met_forecasts, get_location_hourly_weather_forecasts, load_json_data, save_json_data
from helpers.utils import checkKey, get_closest_channel, convert_local_string_date_to_tz_aware_datetime, string_to_hourly_datetime
from helpers.utils import get_gp_predictions, str_to_date


def test_good_get_closest_channel():
    assert get_closest_channel(-0.2, 29.9)== 672528

def test_good_get_gp_predictions():
    assert len(get_gp_predictions()) == 10000

def test_good_str_to_date():
    assert str_to_date('2020-02-01 00:00:00') == datetime(2020, 2, 1, 0, 0, 0)

