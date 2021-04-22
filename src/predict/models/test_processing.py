import pytest
from datetime import datetime
import sys
sys.path.append('./')
from models.processing import forecast_hours

def test_forecast_hours():
    forecast_hrs = forecast_hours(datetime.strptime('2020-01-24 00:00', "%Y-%m-%d %H:%M"))
    assert len(forecast_hrs[0]) == 24

def test_raises_exception_on_non_datetime_arg():
    with pytest.raises(AttributeError):
        forecast_hours('2020-01-24 00:00')

def test_raises_exception_on_no_arg():
    with pytest.raises(TypeError):
        forecast_hours()

