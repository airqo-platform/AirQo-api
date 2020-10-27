base_url = '/api/v1'
route = {
    'root': '/',
    'health_check': '/health',
    'get_coordinates': base_url + '/coordinates',
    'averages_training':base_url + '/train',
    'averages_prediction': base_url + '/predict/',
    'predict_channel_next_24hrs' : base_url+ '/channel/predict/', 
    'predict_for_heatmap' : base_url+'/predict/heatmap'

}