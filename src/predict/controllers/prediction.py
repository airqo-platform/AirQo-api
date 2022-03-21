from flask import Blueprint, request, jsonify
from models.predict import make_prediction, make_prediction_using_averages
from helpers.utils import checkKey, get_closest_channel, get_gp_predictions, get_gp_predictions_id
from models.predict import make_prediction, make_prediction_using_averages, get_next_24hr_predictions_for_channel
from helpers.validation import validate_inputs, validate_inputs_for_next_24hour_predictions
import logging
from models import datamanagement as dm
import datetime as dt
import sys
import os
from datetime import datetime
from flask_caching import Cache
from routes import api
from flask_cors import CORS
from config import constants
from dotenv import load_dotenv
load_dotenv()

app_configuration = constants.app_config.get(os.getenv('FLASK_ENV'))

cache = Cache(config={
    'CACHE_TYPE': 'redis',
    'CACHE_REDIS_HOST': app_configuration.REDIS_SERVER,
    'CACHE_REDIS_PORT': os.getenv('REDIS_PORT'),
    'CACHE_REDIS_URL': f"redis://{app_configuration.REDIS_SERVER}:{os.getenv('REDIS_PORT')}",
})


_logger = logging.getLogger(__name__)

ml_app = Blueprint('ml_app', __name__)


@ml_app.route(api.route['next_24hr_predictions'], methods=['GET'])
def get_next_24hr_predictions(device_channel_id, prediction_start_time):
    '''
    Get predictions for the next 24 hours from specified start time.
    '''
    if request.method == 'GET':
        if type(device_channel_id) is not int:
            device_channel_id = int(device_channel_id)

        if type(prediction_start_time) is not int:
            try:
                prediction_start_time = int(prediction_start_time)
            except ValueError:
                error = {
                    "message": "Invalid prediction start time. expected unix timestamp format like 1500000000", "success": False}
                return jsonify(error, 400)

        prediction_start_timestamp = dt.datetime.fromtimestamp(
            prediction_start_time)
        prediction_start_datetime = dt.datetime.strftime(
            prediction_start_timestamp, "%Y-%m-%d %H:00:00")
        print(prediction_start_datetime)
        result = get_next_24hr_predictions_for_channel(
            device_channel_id, prediction_start_datetime)
        if result:
            response = result
        else:
            response = {
                "message": "predictions for channel are not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@ml_app.route(api.route['averages_training'], methods=['GET'])
def train_averages_model():
    if request.method == 'GET':
        static_channel_list = dm.get_all_static_channels()
        last_channel_best_config, obtained_best_config_dict, best_model_configurations = train_channels_in_range_inclusive_for_averages_model(
            0, len(static_channel_list))
        result = dm.save_configurations(best_model_configurations)
        if result == 'Records saved successfully.':
            return jsonify({'saved': 'successfully'})
        else:
            return jsonify({'errors': result})


@ml_app.route(api.route['get_coordinates'], methods=['GET'])
def get_coordinates():
    if request.method == 'GET':
        all_coordinates = dm.get_all_coordinates()
        _logger.info(all_coordinates)
        return jsonify({'coordinates': all_coordinates})


@ml_app.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'


@ml_app.route('/api/v1/predict/sarimax', methods=['POST'])
def predict():
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        _logger.info(f'Inputs: {json_data}')
        # print(json_data)
        input_data, errors = validate_inputs(input_data=json_data)

        if not errors:
            entered_latitude = float(json_data["latitude"])
            enter_longitude = float(json_data["longitude"])
            enter_time = json_data["selected_datetime"]

            channel_id_with_specified_coordinates = dm.get_channel_id(
                entered_latitude, enter_longitude)
            print("channel id :", channel_id_with_specified_coordinates)
            if channel_id_with_specified_coordinates == 0:
                channel_id_with_specified_coordinates = get_closest_channel(
                    entered_latitude, enter_longitude)
                print("channel id closest", channel_id_with_specified_coordinates)
                print("type of data", type(channel_id_with_specified_coordinates))

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
                                'prediction_start_time': start_time})
            else:
                return jsonify({'errors': 'channel not found.'
                                })
        else:
            _logger.info(f'errors: {errors}')

            return jsonify({'inputs': json_data,
                            'errors': errors
                            })


@ml_app.route(api.route['averages_prediction'], methods=['POST'])
def predict_avgs():
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        _logger.info(f'Inputs: {json_data}')
        input_data, errors = validate_inputs(input_data=json_data)

        if not errors:
            entered_latitude = json_data["latitude"]
            entered_longitude = json_data["longitude"]
            enter_time = json_data["selected_datetime"]

            channel_id_with_specified_coordinates = dm.get_channel_id(
                entered_latitude, entered_longitude)
            print("channel id :", channel_id_with_specified_coordinates)
            if channel_id_with_specified_coordinates == 0:
                channel_id_with_specified_coordinates = get_closest_channel(
                    entered_latitude, entered_longitude)
                print("channel id closest", channel_id_with_specified_coordinates)
                print("type of data", type(channel_id_with_specified_coordinates))

            entered_chan = channel_id_with_specified_coordinates
            entered_time = dt.datetime.strptime(enter_time, "%Y-%m-%d %H:%M")

            print('type of latitude:', type(entered_latitude))

            if entered_chan != "Channel Id Not available":
                formatted_results = make_prediction_using_averages(entered_chan, entered_time,
                                                                   entered_latitude, entered_longitude)

                return jsonify({'formatted_results': formatted_results})
            else:
                return jsonify({'errors': 'location predictions are not available currently.'}), 404
        else:
            _logger.info(f'errors: {errors}')
            return jsonify({'inputs': json_data, 'errors': errors}), 400


@ml_app.route(api.route['predict_channel_next_24hrs'], methods=['POST'])
def predict_channel_next_24_hours():
    '''
    predicts the next pm2.5 values for the next 24 hours for the specified channel
    from the selected time.
    '''
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        _logger.info(f'Inputs: {json_data}')
        input_data, errors = validate_inputs_for_next_24hour_predictions(
            input_data=json_data)

        if not errors:
            channel_id = int(json_data["channel_id"])
            enter_time = json_data["selected_datetime"]
            entered_channel_exists, channel = dm.check_channel_id_exists(
                channel_id)
            entered_chan = channel_id
            entered_time = dt.datetime.strptime(enter_time, "%Y-%m-%d %H:%M")

            if entered_channel_exists == True:
                latitude = channel.get('latitude')
                longitude = channel.get('longitude')
                formatted_results = make_prediction_using_averages(entered_chan, entered_time,
                                                                   latitude, longitude)

                return jsonify({'formatted_results': formatted_results})
            else:
                return jsonify({'errors': 'Selected channel does not exist, location predictions are not available currently.'}), 404
        else:
            _logger.info(f'errors: {errors}')
            return jsonify({'inputs': json_data, 'errors': errors}), 400


@ml_app.route(api.route['predict_for_heatmap'], methods=['GET'])
def predictions_for_heatmap():
    '''
    makes predictions for a specified location at a given time.
    '''
    if request.method == 'GET':
        try:
            airqloud = request.args.get('airqloud').lower()
            data = get_gp_predictions(airqloud)
        except:
            try:
                aq_id = request.args.get('id')
                data = get_gp_predictions_id(aq_id)
            except:
                return {'message': 'Please specify an airqloud', 'success': False}, 400
        if len(data)>0:
            return {'success': True, 'data': data}, 200
        else:
            return {'message': 'No data for specified AirQloud', 'success': False}, 400
    else:
        return {'message': 'Wrong request method. This is a GET endpoint.', 'success': False}, 400
        
if __name__=='__main__':
    print(predictions_for_heatmap())

