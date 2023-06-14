base_url = '/api/v1'
base_url_v2 = '/api/v2'
route = {
    'root': '/',
    'health_check': '/health',
    'get_coordinates': f'{base_url}/coordinates',
    'averages_training': f'{base_url}/train',
    'averages_prediction': f'{base_url}/predict/',
    'predict_channel_next_24hrs': f'{base_url}/channel/predict/',
    'next_24hr_forecasts': f'{base_url_v2}/predict/hourly-forecast',
    'next_1_week_forecasts': f'{base_url_v2}/predict/daily-forecast',
    'search_predictions': f'{base_url_v2}/predict/search',
    'predict_for_heatmap': f'{base_url_v2}/predict/heatmap'
}
