import pytest
import sys
from datetime import datetime
sys.path.append('../')
from helpers.utils import get_hourly_met_forecasts, get_location_hourly_weather_forecasts, load_json_data, save_json_data
from helpers.utils import checkKey, get_closest_channel, convert_local_string_date_to_tz_aware_datetime, string_to_hourly_datetime
from helpers.utils import get_gp_predictions, str_to_date

#def test_get_hourly_met_forecasts():
#    print('test_get_hourly_met_forecasts')

#def test_get_location_hourly_weather_forecasts(latitude:float, longitude:float):
#    print('test_get_location_hourly_weather_forecasts')

#def test_load_json_data(full_file_path):
#    print('test_load_json_data')

#def test_save_json_data(file_name, data_to_save):
#    print('test_save_json_data')

#def test_checkKey(dict, key):
#    print('test_checkKey')

#def test_get_closest_channel(latitude, longitude) -> int:
#    print('test_get_closest_channel')

#def test_convert_local_string_date_to_tz_aware_datetime(local_date_string):
#    print('test_convert_local_string_date_to_tz_aware_datetime')

#def test_string_to_hourly_datetime(my_list):
#    print('test_string_to_hourly_datetime')

#def test_get_gp_predictions():
#    print('test_get_gp_predictions')

def test_good_date():
    print('test_str_to_date')
    assert str_to_date('2020-02-01 00:00:00') == datetime(2020, 2, 1, 0, 0, 0)

