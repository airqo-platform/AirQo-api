import pytest
import sys
import os
import pandas as pd
from unittest.mock import patch 
from datetime import datetime
sys.path.append('./')
from helpers.utils import get_hourly_met_forecasts, get_location_hourly_weather_forecasts, load_json_data, save_json_data
from helpers.utils import checkKey, get_closest_channel, convert_local_string_date_to_tz_aware_datetime, string_to_hourly_datetime
from helpers.utils import get_gp_predictions, str_to_date

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

class MockMongoClient:
    pass



@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_closest_channel(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    assert get_closest_channel(0.32, 32.10)== 123

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_raises_exception_on_non_numerical_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_closest_channel('cinder', 'ella')

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_raises_exception_on_no_of_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_closest_channel(32.1)

@patch('pymongo.MongoClient')
def test_get_gp_predictions(mock_mongo_client):
    mock_mongo_client = MockMongoClient()
    assert len(get_gp_predictions()) != 0

def test_str_to_date():
    assert str_to_date('2020-02-01 00:00:00') == datetime(2020, 2, 1, 0, 0, 0)

def test_raises_exception_on_non_string_args():
    with pytest.raises(TypeError):
        str_to_date(12)

def test_raises_exception_on_incorrect_string_args():
    with pytest.raises(ValueError):
        str_to_date('Cinderella')


