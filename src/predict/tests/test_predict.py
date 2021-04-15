import pytest
import pandas as pd
from unittest.mock import patch 
import sys
from datetime import datetime
sys.path.append('./')
from models.predict import connect_mongo, make_prediction_using_averages, fill_gaps_and_set_datetime, simple_forecast_ci
from models.datamanagement import get_channel_data_raw, calculate_hourly_averages

class MockIterator:
    def __init__(self):
        self.total_rows = 3
        self.data =  pd.DataFrame([
            {'channel_id': 123, 'number_of_days_to_use': 2, 'considered_hours': 24, 'latitude': 0.32, 'longitude': 32.10},
            {'channel_id': 123, 'number_of_days_to_use': 5, 'considered_hours': 24, 'latitude': 0.32, 'longitude': 32.10},
            {'channel_id': 123, 'number_of_days_to_use': 10, 'considered_hours': 24, 'latitude': 0.32, 'longitude': 32.10}
            ])
        self.index=0

    def __iter__(self):
        return self
    
    def __next__(self):
        if self.index < self.data.shape[0]:
            result = self.data.iloc[self.index]
            self.index+=1
            return result
        else:
            raise StopIteration

class MockDf:
    def to_dataframe(self):
        data = {'time': ['2019-11-27T17:33:05Z', '2019-11-22T18:08:26Z'], 
        'pm2_5': ['30', '40'],
        'channel_id': ['123', '123']}
        return pd.DataFrame(data=data)

    def result(self):
        return MockIterator()

class MockClient:
    def query(self, *args, **kwargs):
        return MockDf()

class MockQuery:
    def __init__(self):
        self.use_legacy_sql =False

@pytest.fixture
def data():
    return calculate_hourly_averages(get_channel_data_raw(718028))

@pytest.fixture
def clean_data(data):
    clean_df = fill_gaps_and_set_datetime(data)
    data = {'data':clean_df.values,
    'number_of_days':7, 
    'considered_hours': 24
    }
    return data

@patch('google.cloud.bigquery.Client')
def test_connect_mongo(mock_client):
    mock_client.return_value=MockClient()
    db = connect_mongo()
    assert 'devices' in db.list_collection_names()

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_make_prediction_using_averages(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    data = {
        'chan': '123',
        'time':datetime.strptime('2020-01-24 00:00', "%Y-%m-%d %H:%M"),
        'lat': '0.32',
        'long': '32.10'
        }
    predictions = make_prediction_using_averages(data['chan'], data['time'], data['lat'], data['long'])
    assert list(predictions.keys()) == ['predictions']

def test_avg_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        make_prediction_using_averages()

def test_avg_raises_exception_on_wrong_arg():
    with pytest.raises(ValueError):
        make_prediction_using_averages('wrong_arg', datetime.strptime('2020-01-24 00:00', "%Y-%m-%d %H:%M"), '0.3075', '32.6206')

def test_avg_raises_exception_on_too_many_args():
    with pytest.raises(TypeError):
        make_prediction_using_averages('718028', datetime.strptime('2020-01-24 00:00', "%Y-%m-%d %H:%M"), '0.3075', '32.6206', 'additional_arg')

def test_fill_gaps_and_set_datetime(data):
    clean_df = fill_gaps_and_set_datetime(data)
    assert clean_df['pm2_5'].isna().sum() ==0 and clean_df.index[0].hour

def test_gaps_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        fill_gaps_and_set_datetime()

def test_gaps_raises_exception_on_wrong_arg():
    with pytest.raises(ValueError):
        clean_df = fill_gaps_and_set_datetime('random_string')

def test_gaps_raises_exception_on_too_many_args(data):
    with pytest.raises(TypeError):
        clean_df = fill_gaps_and_set_datetime(data, pd.DataFrame())

def test_simple_forecast_ci(clean_data):
    test_forecast = simple_forecast_ci(clean_data['data'], clean_data['number_of_days'], clean_data['considered_hours']) 
    assert type(test_forecast) == tuple and len(test_forecast)==3


def test_forecast_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        simple_forecast_ci()

def test_forecast_raises_exception_on_wrong_arg():
    with pytest.raises(TypeError):
        simple_forecast_ci('numpy', 10,  24)

def test_forecast_raises_exception_on_too_many_args(clean_data):
    #hourly_df = calculate_hourly_averages(get_channel_data_raw(718028))
    #clean_df = fill_gaps_and_set_datetime(hourly_df)
    #data = {'data':clean_df.values,
    #'number_of_days':7, 
    #'considered_hours': 24
    #}

    with pytest.raises(TypeError):
        simple_forecast_ci(clean_data['data'], clean_data['number_of_days'], clean_data['considered_hours'], 32) 
