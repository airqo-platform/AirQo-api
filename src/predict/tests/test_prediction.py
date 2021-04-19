import pytest
from unittest import mock
import sys
import requests
sys.path.append('./')

def test_get_next_24hr_predictions():
    response = requests.get('http://127.0.0.1:5000/api/v2/predict/730016/1597336460')
    assert response.status_code== 201

def test_predict_avgs():
    json_data = {
        "selected_datetime":"2020-01-24 00:00",
        "latitude":"0.3284992",
        "longitude":"32.5396499"
        }
    response = requests.post('http://127.0.0.1:5000/api/v1/predict', data=json_data)
    assert response.status_code== 200

def test_bad_predict_avgs():
    response = requests.post('http://127.0.0.1:5000/api/v1/predict')
    assert response.status_code== 400


def test_predictions_for_heatmap():
    response = requests.get('http://127.0.0.1:5000/api/v1/predict/heatmap')
    assert response.status_code== 200
