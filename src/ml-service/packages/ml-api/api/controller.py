from flask import Blueprint, request, jsonify
from api.predict import make_prediction, make_prediction_using_averages
from api.utils import get_channel_id, checkKey, get_closest_channel, get_all_coordinates
from api import model_config
from api.validation import validate_inputs

from api.config import get_logger

_logger = get_logger(logger_name=__name__)


ml_app = Blueprint('ml_app', __name__)

@ml_app.route('/api/v1/coordinates', methods=['GET'])
def get_coordinates():
    if request.method == 'GET':
        all_coordinates = get_all_coordinates()
        _logger.info(all_coordinates)
        return jsonify({'coordinates': all_coordinates})
       
        

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
        input_data, errors = validate_inputs(input_data=json_data)

        if not errors:        
            entered_latitude = json_data["latitude"]
            enter_longitude  = json_data["longitude"]
            enter_time = json_data["selected_datetime"]

            channel_id_with_specified_coordinates = get_channel_id(entered_latitude,enter_longitude)
            print("channel id :", channel_id_with_specified_coordinates)
            if channel_id_with_specified_coordinates == 0:
                channel_id_with_specified_coordinates = get_closest_channel(entered_latitude,enter_longitude)
                print("channel id closest", channel_id_with_specified_coordinates)
                print("type of data", type(channel_id_with_specified_coordinates))

            #enter_chan = checkKey(model_config.CHANNEL_ID_MAPPING_CONFIG_DICT, channel_id_with_specified_coordinates)
            enter_chan = channel_id_with_specified_coordinates
            print("enter channel:", enter_chan)
            print(enter_chan)

            if enter_chan != "Channel Id Not available":       
                result = make_prediction(enter_chan, enter_time)
                _logger.info(f'Outputs: {result}')

                predictions = result.get('predictions')
                confidence_intervals = result.get('prediction_ci')
                start_time = result.get('prediction time')

                return jsonify({'predictions': predictions,
                                'confidence_intervals': confidence_intervals,
                                'prediction_start_time':start_time})
            else:
                 return jsonify({'errors': 'channel not found.'
                        })
        else:
            _logger.info(f'errors: {errors}')

            return jsonify({'inputs': json_data,
                        'errors': errors
                        })



@ml_app.route('/api/v1/predict/v2/', methods=['POST'])
def predictx():
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
               return {'message': 'No input data provided'}, 400
        _logger.info(f'Inputs: {json_data}')
        #print(json_data)
        input_data, errors = validate_inputs(input_data=json_data)
        print(input_data)
        print(errors)
        print(type(errors))
        if not errors:
            ## continue with executing prediction api
            return jsonify({'inputs': input_data})
        else:
            print("passed data has errors.")
            return jsonify({'inputs': json_data,
                        'errors': errors
                        })


@ml_app.route('/api/v1/predict/avg', methods=['POST'])
def predict_avgs():
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
               return {'message': 'No input data provided'}, 400
        _logger.info(f'Inputs: {json_data}')
        input_data, errors = validate_inputs(input_data=json_data)

        if not errors:        
            entered_latitude = json_data["latitude"]
            enter_longitude  = json_data["longitude"]
            enter_time = json_data["selected_datetime"]

            channel_id_with_specified_coordinates = get_channel_id(entered_latitude,enter_longitude)
            print("channel id :", channel_id_with_specified_coordinates)
            if channel_id_with_specified_coordinates == 0:
                channel_id_with_specified_coordinates = get_closest_channel(entered_latitude,enter_longitude)
                print("channel id closest", channel_id_with_specified_coordinates)
                print("type of data", type(channel_id_with_specified_coordinates))

            enter_chan = channel_id_with_specified_coordinates

            if enter_chan != "Channel Id Not available":       
                result = make_prediction_using_averages(enter_chan, enter_time)
                _logger.info(f'Outputs: {result}')

                predictions = result.get('predictions')
                upper_confidence_intervals = result.get('prediction_upper_ci')
                start_time = result.get('prediction_start_time')
                prediction_hours = result.get('prediction_hours')
                lower_confidence_intervals = result.get('prediction_lower_ci')

                return jsonify({'predictions': predictions,
                                'upper_confidence_intervals': upper_confidence_intervals,
                                'lower_confidence_intervals': lower_confidence_intervals,
                                'prediction_hours': prediction_hours,
                                'prediction_start_time':start_time})
            else:
                 return jsonify({'errors': 'channel not found.'
                        })
        else:
            _logger.info(f'errors: {errors}')

            return jsonify({'inputs': json_data,
                        'errors': errors
                        })
       
        
        
        

        

