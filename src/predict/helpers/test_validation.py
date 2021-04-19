import sys
import pytest
sys.path.append('./')
from helpers.validation import validate_inputs, validate_inputs_for_next_24hour_predictions


def test_validate_inputs():
    test_data = {
        'selected_datetime':'2020-01-24 00:00',
        'latitude':'0.3284992',
        'longitude':'32.5396499'
        }
    results = validate_inputs(test_data)
    assert len(results[0])==3 and results[1] == None

def test_all_invalid_args():
    test_data = {
        'selected_datetime': 10,
        'latitude':'lat',
        'longitude':'long'
        }
    results = validate_inputs(test_data)
    assert results[1] != None and len(results[0])==0

def test_invalid_dt():
    test_data = {
        'selected_datetime': 10,
        'latitude':0.32,
        'longitude': 32
        }
    results = validate_inputs(test_data)
    assert len(results[1]) == 1 and len(results[0])==2

def test_invalid_lat():
    test_data = {
        'selected_datetime': '2020-01-24 00:00',
        'latitude': 'Aladdin',
        'longitude': 32
        }
    results = validate_inputs(test_data)
    assert len(results[1]) == 1 and len(results[0])==2

def test_invalid_long():
    test_data = {
        'selected_datetime': '2020-01-24 00:00',
        'latitude': 0.32,
        'longitude': 'Rapunzel'
        }
    results = validate_inputs(test_data)
    assert len(results[1]) == 1 and len(results[0])==2

    
    