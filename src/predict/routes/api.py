base_url = '/api/v1'
base_url_v2 = '/api/v2'
route = {
    'root': '/',
    'health_check': '/health',
    'get_coordinates': base_url + '/coordinates',
    'averages_training':base_url + '/train',
    'averages_prediction': base_url + '/predict/',
    'predict_channel_next_24hrs' : base_url+ '/channel/predict/',
    'next_24hr_predictions': base_url_v2 + '/predict/<int:device_channel_id>/<prediction_start_time>',
    'predict_for_heatmap' : base_url+'/predict/heatmap'

}