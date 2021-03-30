import sys
import pytest
sys.path.append('../')
from helpers.validation import validate_inputs, validate_inputs_for_next_24hour_predictions


def test_filter_error_rows():
    pass


def test_validate_inputs():
    test_data = {
        'selected_datetime':'2020-01-24 00:00',
        'latitude':'0.3284992',
        'longitude':'32.5396499'
        }
    assert len(validate_inputs(data))==2 and validate_inputs(data)[1] == None


def test_validate_inputs_for_next_24hour_predictions():
    pass

if __name__=='__main__':
    data = {
        'selected_datetime':'2020-01-24 00:00',
        'latitude':'0.3284992',
        'longitude':'32.5396499'
        }
    validate_results=validate_inputs(data)
    if len(validate_inputs(data))==2 and validate_inputs(data)[1] == None: 
        print('Yes')
    else:
        print('No')