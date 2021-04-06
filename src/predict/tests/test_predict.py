import pytest
import sys
from datetime import datetime
sys.path.append('./')
from models.predict import connect_mongo, make_prediction_using_averages, fill_gaps_and_set_datetime, simple_forecast_ci

def test_connect_mongo():
    db = connect_mongo()
    assert 'devices' in db.list_collection_names()

def test_make_prediction_using_averages():
    pass
    #make_prediction_using_averages(entered_chan, entered_time, entered_latitude, entered_longitude)
    


def test_fill_gaps_and_set_datetime():
    pass

def test_simple_forecast_ci():
    pass

if __name__ =='__main__':
    data = {
        'chan':'689761',
        'time':datetime.strptime('2020-01-24 00:00', "%Y-%m-%d %H:%M"),
        'lat': '0.314',
        'long':'32.59'
        }
    predictions =make_prediction_using_averages(data['chan'], data['time'], data['lat'], data['long'])
    print(predictions)
