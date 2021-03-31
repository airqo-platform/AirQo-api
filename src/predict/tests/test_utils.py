import pytest
import sys
import os
from datetime import datetime
sys.path.append('./')
from helpers.utils import get_hourly_met_forecasts, get_location_hourly_weather_forecasts, load_json_data, save_json_data
from helpers.utils import checkKey, get_closest_channel, convert_local_string_date_to_tz_aware_datetime, string_to_hourly_datetime
from helpers.utils import get_gp_predictions, str_to_date

def test_get_closest_channel():
    assert get_closest_channel(-0.2, 29.9)== 672528

def test_raises_exception_on_non_numerical_args():
    with pytest.raises(TypeError):
        get_closest_channel('cinder', 'ella')

def test_raises_exception_on_no_of_args():
    with pytest.raises(TypeError):
        get_closest_channel(32.1)

def test_get_gp_predictions():
    assert len(get_gp_predictions()) == 10000

def test_str_to_date():
    assert str_to_date('2020-02-01 00:00:00') == datetime(2020, 2, 1, 0, 0, 0)

def test_raises_exception_on_non_string_args():
    with pytest.raises(TypeError):
        str_to_date(12)

def test_raises_exception_on_incorrect_string_args():
    with pytest.raises(ValueError):
        str_to_date('Cinderella')

