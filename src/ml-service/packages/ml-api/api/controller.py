from flask import Blueprint, request, jsonify
from api.predict import make_prediction

from api.config import get_logger

_logger = get_logger(logger_name=__name__)


ml_app = Blueprint('ml_app', __name__)


@ml_app.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'

@ml_app.route('/api/v1/predict/', methods=['POST'])
def predict():
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
               return {'message': 'No input data provided'}, 400
        _logger.info(f'Inputs: {json_data}')
        #print(json_data)

        #return jsonify(json_data)
        enter_chan = json_data["channel"]
        enter_time = json_data["start_time"]

        result = make_prediction(enter_chan, enter_time)
        _logger.info(f'Outputs: {result}')

        predictions = result.get('predictions')
        confidence_intervals = result.get('prediction_ci')
        start_time = result.get('prediction time')

        return jsonify({'predictions': predictions,
                        'confidence_intervals': confidence_intervals,
                        'prediction_start_time':start_time})
