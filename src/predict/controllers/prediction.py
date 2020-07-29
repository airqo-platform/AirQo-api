from flask import Blueprint, request, jsonify
from models.predict import make_prediction, make_prediction_using_averages 
from helpers.utils import checkKey, get_closest_channel
from helpers.validation import validate_inputs, validate_inputs_for_next_24hour_predictions
import logging
from models import datamanagement as dm
import datetime as dt


from routes import api
from flask_cors import CORS


_logger = logging.getLogger(__name__)

ml_app = Blueprint('ml_app', __name__)


@ml_app.route(api.route['averages_training'], methods=['GET'])
def train_averages_model():
    if request.method == 'GET':
        static_channel_list = dm.get_all_static_channels()
        last_channel_best_config, obtained_best_config_dict, best_model_configurations = train_channels_in_range_inclusive_for_averages_model(0,len(static_channel_list))
        result = dm.save_configurations(best_model_configurations)
        if result == 'Records saved successfully.':
            return jsonify({'saved':'successfully'})
        else:
            return jsonify({'errors': result} )



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
        #print(json_data)
        input_data, errors = validate_inputs(input_data=json_data)

        if not errors:        
            entered_latitude = float(json_data["latitude"])
            enter_longitude  = float(json_data["longitude"])
            enter_time = json_data["selected_datetime"]

            channel_id_with_specified_coordinates = dm.get_channel_id(entered_latitude,enter_longitude)
            print("channel id :", channel_id_with_specified_coordinates)
            if channel_id_with_specified_coordinates == 0:
                channel_id_with_specified_coordinates = get_closest_channel(entered_latitude,enter_longitude)
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
                                'prediction_start_time':start_time})
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
            entered_longitude  = json_data["longitude"]
            enter_time = json_data["selected_datetime"]

            channel_id_with_specified_coordinates = dm.get_channel_id(entered_latitude,entered_longitude)
            print("channel id :", channel_id_with_specified_coordinates)
            if channel_id_with_specified_coordinates == 0:
                channel_id_with_specified_coordinates = get_closest_channel(entered_latitude,entered_longitude)
                print("channel id closest", channel_id_with_specified_coordinates)
                print("type of data", type(channel_id_with_specified_coordinates))

            entered_chan = channel_id_with_specified_coordinates
            entered_time = dt.datetime.strptime(enter_time,"%Y-%m-%d %H:%M")

            print('type of latitude:', type(entered_latitude))

            if entered_chan != "Channel Id Not available":
                formatted_results = make_prediction_using_averages(entered_chan, entered_time, 
                    entered_latitude,entered_longitude)              

                return jsonify({'formatted_results': formatted_results})
            else:
                 return jsonify({'errors': 'location predictions are not available currently.'}), 404
        else:
            _logger.info(f'errors: {errors}')
            return jsonify({'inputs': json_data,'errors': errors }), 400
       
          

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
        input_data, errors = validate_inputs_for_next_24hour_predictions(input_data=json_data)

        if not errors:        
            channel_id = int(json_data["channel_id"])            
            enter_time = json_data["selected_datetime"]           
            entered_channel_exists , channel = dm.check_channel_id_exists(channel_id)
            entered_chan = channel_id
            entered_time = dt.datetime.strptime(enter_time,"%Y-%m-%d %H:%M")            

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
            return jsonify({'inputs': json_data,'errors': errors }), 400

