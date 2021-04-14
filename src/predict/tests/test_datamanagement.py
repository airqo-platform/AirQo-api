import pytest
import mongomock
from unittest.mock import patch 
import sys
sys.path.append('./')
from models.datamanagement import get_channel_data_raw, save_predictions, get_channel_best_configurations
from models.datamanagement import calculate_hourly_averages, get_channel_id, get_all_coordinates
import pandas as pd
from google.cloud import bigquery
from datetime import datetime

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

class MockDataset:
    def table(self, *args, **kwargs):
        pass

class MockClient:
    def query(self, *args, **kwargs):
        return MockDf()

    def dataset(self, *args, **kwargs):
        return MockDataset()

    def get_table(self, *args, **kwargs):
        pass

    def insert_rows(self, *args, **kwargs):
        pass

class MockQuery:
    def __init__(self):
        self.use_legacy_sql =False


@pytest.fixture
#def sample_df():
#    data = {'time': ['2019-11-27T17:33:05Z', '2019-11-22T18:08:26Z'], 
#        'pm2_5': ['30', '40'],
#        'channel_id': ['123', '12345']}
#
#    return calculate_hourly_averages(get_channel_data_raw(718028))


@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_channel_data_raw(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    sample_df = get_channel_data_raw(123)
    assert len(sample_df.shape)==2 and sample_df.shape[0]!=0
    
@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_raises_exception_on_empty_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_data_raw()

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_raises_exception_on_wrong_type_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_data_raw('Snow white')

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_raises_exception_on_too_many_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_data_raw(123, 123)

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_raises_exception_on_incorrect_int(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(ValueError):
        get_channel_data_raw(123)


@patch('google.cloud.bigquery.Client')
def test_save_predictions(mock_client):
    model_predictions = [('test_model', 82, 'bwaise', 0.32, 32.1, 10.3, datetime(2020, 2, 1, 0, 0, 0), datetime(2020, 2, 1, 0, 0, 0), 
    0.3, 20.3, datetime(2020, 2, 1, 0, 0, 0))]
    mock_client.return_value=MockClient()
    save_predictions(model_predictions)


@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_channel_best_configurations(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    best_config = get_channel_best_configurations(123)
    assert len(best_config)!= 0 and 'number_of_days_to_use' in best_config[0].keys()

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_config_raises_exception_on_empty_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_best_configurations()

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_config_raises_exception_on_wrong_type_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_best_configurations('Snow white')

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_config_raises_exception_on_too_many_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
       get_channel_best_configurations(123, 123)

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_config_raises_exception_on_incorrect_int(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(ValueError):
        get_channel_best_configurations(123)

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_calculate_hourly_averages(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    sample_df = get_channel_data_raw(123)
    hourly_df = calculate_hourly_averages(sample_df)
    assert hourly_df.iloc[0]['time'].minute == 0 and hourly_df.iloc[-1]['time'].minute == 0

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_avg_raises_exception_on_empty_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        calculate_hourly_averages()

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_avg_raises_exception_on_wrong_type_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        calculate_hourly_averages(pd.Series())

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_avg_raises_exception_on_too_many_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
       calculate_hourly_averages(pd.DataFrame(), pd.DataFrame())

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_avg_raises_exception_on_empty_df(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(ValueError):
        calculate_hourly_averages(pd.DataFrame())

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_channel_id(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    assert get_channel_id('0.314', '32.59') ==123

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_id_raises_exception_on_empty_arg(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_id()

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_id_raises_exception_on_wrong_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(ValueError):
        get_channel_id('Bruce', 'Wayne')

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_id_raises_exception_on_too_many_args(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
       get_channel_id('0.314', '32.59', '28.3')

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_id_raises_exception_on_wrong_types(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    with pytest.raises(TypeError):
        get_channel_id([1,2,3], ['a', 'b', 'c'])

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_all_coordinates(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    coords = get_all_coordinates()
    assert type(coords) == list and list(coords[0].keys()) == ['channel_id', 'latitude', 'longitude']


