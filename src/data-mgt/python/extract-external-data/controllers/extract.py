from routes import api
from flask import Blueprint, request, jsonify
from models import extract as ext
from helpers import validation

extract_bp = Blueprint('extract_bp', __name__)

@extract_bp.route(api.GREENNESS_URL, methods=['GET'])
def get_greenness():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    start_date = request.args.get('startDate')
    end_date = request.args.get('endDate')
    
    input_params= {'latitude':latitude, 'longitude':longitude,
     'start_date':start_date, 'end_date':end_date}
    input_data, errors = validation.validate_inputs(input_data=input_params)

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    greenness = model.get_greenness(input_data['latitude'],input_data['longitude'],
     input_data['start_date'], input_data['end_date'])
   
    response = dict(message="greenness value returned successfully", data=greenness)
    return jsonify(response), 200


@extract_bp.route(api.ALTITUDE_URL, methods=['GET'])
def get_altitude():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    altitude = model.get_altitude(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="altitude value returned successfully", data=altitude)
    return jsonify(response), 200


@extract_bp.route(api.ASPECT_URL, methods=['GET'])
def get_aspect():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_aspect_270(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="aspect value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.LANDFORM90_URL, methods=['GET'])
def get_landform90():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_landform90(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="landform value returned successfully", data=result)
    return jsonify(response), 200

@extract_bp.route(api.LANDFORM270_URL, methods=['GET'])
def get_landform270():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_landform270(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="landform value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.BEARING_FROM_KAMPALA_URL, methods=['GET'])
def get_bearing_from_kampala():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    print(input_data)
    model =  ext.Extract()
    result = model.get_bearing_from_kampala(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="bearing from kampala value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_FROM_KAMPALA_URL, methods=['GET'])
def get_distance_from_kampala():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_from_kampala(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance from kampala value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_ROAD_URL, methods=['GET'])
def get_distance_to_closest_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_road(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_PRIMARY_ROAD_URL, methods=['GET'])
def get_distance_to_closest_primary_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_primary_road(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest primary road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_SECONDARY_ROAD_URL, methods=['GET'])
def get_distance_to_closest_secondary_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_secondary_road(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest secondary road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_RESIDENTIAL_ROAD_URL, methods=['GET'])
def get_distance_to_closest_residential_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_residential_road(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest residential road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_TERTIARY_ROAD_URL, methods=['GET'])
def get_distance_to_closest_tertiary_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_tertiary_road(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest tertiary road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_TRUNK_ROAD_URL, methods=['GET'])
def get_distance_to_closest_trunk_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_trunk(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest trunk road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_UNCLASSIFIED_ROAD_URL, methods=['GET'])
def get_distance_to_closest_unclassified_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_unclassified_road(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest unclassified road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_MOTORWAY_ROAD_URL, methods=['GET'])
def get_distance_to_closest_motorway_road():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_distance_to_closest_motorway(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="distance to closest motorway road returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.LANDUSES_URL, methods=['GET'])
def get_landuse():
    errors = {}
    latitude = request.args.get('lat')
    longitude = request.args.get('lon')
    input_data, errors = validation.validate_spatial_data(input_data={'latitude':latitude, 'longitude':longitude})

    if errors:
        return jsonify({
            'message': 'Some errors occurred while processing this request',
            'errors': errors
        }), 400

    model =  ext.Extract()
    result = model.get_landuse(float(input_data['latitude']),float(input_data['longitude']))
   
    response = dict(message="landuse returned successfully", data=result)
    return jsonify(response), 200
