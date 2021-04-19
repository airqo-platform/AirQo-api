import pytest
from unittest.mock import patch 
import sys
import requests
sys.path.append('./')

sample_response = {
  "formatted_results": {
    "predictions": [
      {
        "lower_ci": 66.08,
        "prediction_time": "Thu, 23 Jan 2020 22:00:00 GMT",
        "prediction_value": 110.74,
        "upper_ci": 155.4
      },
      
      {
        "lower_ci": 55.46,
        "prediction_time": "Fri, 24 Jan 2020 11:00:00 GMT",
        "prediction_value": 65.12,
        "upper_ci": 74.77
      },
      
     
    ]
  }
}

@patch('requests.get')
def test_get_next_24hr_predictions(mock_get):
    mock_get.return_value.status_code = 201
    response = requests.get('http://127.0.0.1:5000/api/v2/predict/730016/1597336460')
    assert response.status_code== 201

@patch('request.post')
def test_predict_avgs(mock_post):
    mock_post.return_value.status_code = 500
    json_data = {
        "selected_datetime":"2020-01-24 00:00",
        "latitude":"0.3284992",
        "longitude":"32.5396499"
        }
    response = requests.post('http://127.0.0.1:5000/api/v1/predict', data=json_data)
    assert response.status_code== 200

@patch('request.post') 
def test_bad_predict_avgs(mock_post):
    response = requests.post('http://127.0.0.1:5000/api/v1/predict')
    assert response.status_code== 400

@patch('request.get')
def test_predictions_for_heatmap(mock_get):
    response = requests.get('http://127.0.0.1:5000/api/v1/predict/heatmap')
    assert response.status_code== 200
