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
            {'channel_id': 689761, 'number_of_days_to_use': 2, 'considered_hours': 24, 'latitude': 0.32, 'longitude': 32.10},
            {'channel_id': 689761, 'number_of_days_to_use': 5, 'considered_hours': 24, 'latitude': 0.32, 'longitude': 32.10},
            {'channel_id': 689761, 'number_of_days_to_use': 10, 'considered_hours': 24, 'latitude': 0.32, 'longitude': 32.10}
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

        #for index, row in self.data.iterrows():
        #    return row

class MockDf:
    def to_dataframe(self):
        data = {'time': ['2019-11-27T17:33:05Z', '2019-11-22T18:08:26Z'], 
        'pm2_5': ['30', '40'],
        'channel_id': ['689761', '689761']}
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
    pass



@pytest.fixture
def sample_df():
    data = {'time': ['2019-11-27T17:33:05Z', '2019-11-22T18:08:26Z'], 
        'pm2_5': ['30', '40'],
        'channel_id': ['689761', '12345']}

    return calculate_hourly_averages(get_channel_data_raw(718028))


@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_channel_data_raw(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    sample_df = get_channel_data_raw(689761)
    assert len(sample_df.shape)==2 and sample_df.shape[0]!=0
    

def test_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        get_channel_data_raw()

def test_raises_exception_on_wrong_type_arg():
    with pytest.raises(TypeError):
        get_channel_data_raw('Snow white')

def test_raises_exception_on_too_many_args():
    with pytest.raises(TypeError):
        get_channel_data_raw(689761, 689761)

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
    save_predictions(model_predictions) # i need to run this with mocked objects i.e. the client and the table. the two lines below are an example of assert statements ref: https://stackoverflow.com/questions/53700181/python-unit-testing-google-bigquery

    #mock_table.assert_called_with('project.dataset.blahblahbloo', schema=schema)
    #mock_client().create_table.assert_called_with(mock_table.return_value)
    #pass


@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_channel_best_configurations(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    best_config = get_channel_best_configurations(689761)
    assert len(best_config)!= 0 and 'number_of_days_to_use' in best_config[0].keys()

def test_config_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        get_channel_best_configurations()

def test_config_raises_exception_on_wrong_type_arg():
    with pytest.raises(TypeError):
        get_channel_best_configurations('Snow white')

def test_config_raises_exception_on_too_many_args():
    with pytest.raises(TypeError):
       get_channel_best_configurations(689761, 689761)
#10
def test_config_raises_exception_on_incorrect_int():
    with pytest.raises(ValueError):
        get_channel_best_configurations(123)

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_calculate_hourly_averages(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    sample_df = get_channel_data_raw(689761)
    hourly_df = calculate_hourly_averages(sample_df)
    assert hourly_df.iloc[0]['time'].minute == 0 and hourly_df.iloc[-1]['time'].minute == 0

def test_avg_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        calculate_hourly_averages()

def test_avg_raises_exception_on_wrong_type_arg():
    with pytest.raises(TypeError):
        calculate_hourly_averages(pd.Series())

def test_avg_raises_exception_on_too_many_args():
    with pytest.raises(TypeError):
       calculate_hourly_averages(sample_df, pd.DataFrame())
#15
def test_avg_raises_exception_on_empty_df():
    with pytest.raises(ValueError):
        calculate_hourly_averages(pd.DataFrame())

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_channel_id(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    assert get_channel_id('0.314', '32.59') ==689761

def test_id_raises_exception_on_empty_arg():
    with pytest.raises(TypeError):
        get_channel_id()

def test_id_raises_exception_on_wrong_args():
    with pytest.raises(ValueError):
        get_channel_id('Bruce', 'Wayne')

def test_id_raises_exception_on_too_many_args():
    with pytest.raises(TypeError):
       get_channel_id('0.314', '32.59', '28.3')
#20
def test_id_raises_exception_on_wrong_types():
    with pytest.raises(TypeError):
        get_channel_id([1,2,3], ['a', 'b', 'c'])

@patch('google.cloud.bigquery.Client')
@patch('google.cloud.bigquery.QueryJobConfig')
def test_get_all_coordinates(mock_query, mock_client):
    mock_client.return_value=MockClient()
    mock_query.return_value=MockQuery()
    coords = get_all_coordinates()
    assert type(coords) == list and list(coords[0].keys()) == ['channel_id', 'latitude', 'longitude']

if __name__=='__main__':
    sample_df()
    #print(df.head())



