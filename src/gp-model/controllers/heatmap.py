from flask import Blueprint, request, jsonify
from helpers.utils import get_gp_predictions


@ml_app.route(api.route['predict_for_heatmap'], methods=['GET'])
@cache.cached(timeout=3600)
def predictions_for_kampala_heatmap():
    '''
    makes predictions for a specified location at a given time.
    '''
    if request.method == 'GET':
        try:
            data = get_gp_predictions()
            return {'success': True, 'data': data}, 200
        except:
            return {'message': 'An error occured. Please try again.', 'success': False}, 400
    else:
        return {'message': 'Wrong request method. This is a GET endpoint.', 'success': False}, 400

if __name__=='__main__':
    print('I am daft')

