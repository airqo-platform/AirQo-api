import pytest
from unittest.mock import patch 
import sys
import requests
sys.path.append('./')

@patch('requests.get')
def test_get_next_24hr_predictions(mock_get):
    mock_get.return_value.status_code = 201
    response = requests.get('http://127.0.0.1:5000/api/v2/predict/730016/1597336460')
    assert response.status_code== 201

@patch('requests.post')
def test_predict_avgs(mock_post):
    mock_post.return_value.status_code = 500
    json_data = {
        "selected_datetime":"2020-01-24 00:00",
        "latitude":"0.3284992",
        "longitude":"32.5396499"
        }
    response = requests.post('http://127.0.0.1:5000/api/v1/predict', data=json_data)
    assert response.status_code== 200

@patch('requests.post') 
def test_bad_predict_avgs(mock_post):
    mock_post.return_value.status_code = 500
    response = requests.post('http://127.0.0.1:5000/api/v1/predict')
    assert response.status_code== 400

@patch('requests.get')
def test_predictions_for_heatmap(mock_get):
    mock_get.return_value.status_code = 200
    response = requests.get('http://127.0.0.1:5000/api/v1/predict/heatmap')
    assert response.status_code== 200
