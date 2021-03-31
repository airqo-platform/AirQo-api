import pytest
import sys
sys.path.append('./')
from models.datamanagement import get_channel_data_raw, save_predictions, get_channel_best_configurations
from models.datamanagement import calculate_hourly_averages, get_channel_id, get_all_coordinates
import pandas as pd

@pytest.fixture
def sample_df():
    return get_channel_data_raw(689761)


def test_get_channel_data_raw(sample_df):
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

def test_raises_exception_on_incorrect_int():
    with pytest.raises(ValueError):
        get_channel_data_raw(123)

def test_save_predictions(mocker):
    #model_predictions = [('test_model', 82, 'bwaise', 0.32, 32.1, 10.3, datetime(2020, 2, 1, 0, 0, 0), datetime(2020, 2, 1, 0, 0, 0), 
    #0.3, 20.3, datetime(2020, 2, 1, 0, 0, 0))]
    #mock_table = mocker.patch('google.cloud.bigquery.Table', autospec=True)
    #mock_client = mocker.patch('google.cloud.bigquery.Client', autospec=True)
    #save_predictions(model_predictions) # i need to run this with mocked objects i.e. the client and the table. the two lines below are an example of assert statements ref: https://stackoverflow.com/questions/53700181/python-unit-testing-google-bigquery

    #mock_table.assert_called_with('project.dataset.blahblahbloo', schema=schema)
    #mock_client().create_table.assert_called_with(mock_table.return_value)
    pass



def test_get_channel_best_configurations():
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

def test_config_raises_exception_on_incorrect_int():
    with pytest.raises(ValueError):
        get_channel_best_configurations(123)

def test_calculate_hourly_averages(sample_df):
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

def test_avg_raises_exception_on_empty_df():
    with pytest.raises(ValueError):
        calculate_hourly_averages(pd.DataFrame())

def test_get_channel_id():
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

def test_id_raises_exception_on_wrong_types():
    with pytest.raises(TypeError):
        get_channel_id([1,2,3], ['a', 'b', 'c'])

def test_get_all_coordinates():
    coords = get_all_coordinates()
    assert type(coords) == list and list(coords[0].keys()) == ['channel_id', 'latitude', 'longitude']


if __name__=='__main__':
    pass