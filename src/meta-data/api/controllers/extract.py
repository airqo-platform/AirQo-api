from flasgger import swag_from

from api.routes import api
from flask import Blueprint, request, jsonify
from api.models import extract as ext
from api.helpers import validation

extract_bp = Blueprint("extract_bp", __name__)


@extract_bp.route(api.ALL_META_DATA_URL, methods=["GET"])
def get_all_meta_data():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")

    input_params = {
        "latitude": latitude,
        "longitude": longitude,
    }
    input_data, errors = validation.validate_spatial_data(input_data=input_params)

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    latitude = float(input_data["latitude"])
    longitude = float(input_data["longitude"])

    model = ext.Extract()
    altitude = model.get_altitude(latitude, longitude)
    aspect = model.get_aspect_270(latitude, longitude)
    landform_90 = model.get_landform90(latitude, longitude)
    landform_270 = model.get_landform270(latitude, longitude)
    bearing_from_kampala = model.get_bearing_from_kampala(latitude, longitude)
    distance_from_kampala = model.get_distance_from_kampala(latitude, longitude)
    distance_to_closest_road = model.get_distance_to_closest_road(latitude, longitude)
    distance_to_closest_primary_road = model.get_distance_to_closest_primary_road(
        latitude, longitude
    )
    distance_to_closest_secondary_road = model.get_distance_to_closest_secondary_road(
        latitude, longitude
    )
    distance_to_closest_residential_road = (
        model.get_distance_to_closest_residential_road(latitude, longitude)
    )
    distance_to_closest_tertiary_road = model.get_distance_to_closest_tertiary_road(
        latitude, longitude
    )
    distance_to_closest_trunk = model.get_distance_to_closest_trunk(latitude, longitude)
    distance_to_closest_unclassified_road = (
        model.get_distance_to_closest_unclassified_road(latitude, longitude)
    )
    distance_to_closest_motorway = model.get_distance_to_closest_motorway(
        latitude, longitude
    )
    land_use = model.get_landuse(latitude, longitude)
    weather_stations = model.get_nearest_weather_stations(latitude, longitude)

    data = {
        "altitude": altitude,
        "aspect": aspect,
        "landform_90": landform_90,
        "landform_270": landform_270,
        "bearing_from_kampala": bearing_from_kampala,
        "distance_from_kampala": distance_from_kampala,
        "distance_to_closest_road": distance_to_closest_road,
        "distance_to_closest_secondary_road": distance_to_closest_secondary_road,
        "distance_to_closest_primary_road": distance_to_closest_primary_road,
        "distance_to_closest_residential_road": distance_to_closest_residential_road,
        "distance_to_closest_tertiary_road": distance_to_closest_tertiary_road,
        "distance_to_closest_trunk": distance_to_closest_trunk,
        "distance_to_closest_unclassified_road": distance_to_closest_unclassified_road,
        "distance_to_closest_motorway": distance_to_closest_motorway,
        "weather_stations": weather_stations,
        "land_use": land_use,
    }

    return jsonify(dict(message="Operation successful", data=data)), 200


@extract_bp.route(api.NEAREST_WEATHER_STATIONS, methods=["GET"])
@swag_from("/api/docs/get-nearest-stations.yml")
def get_nearest_weather_stations():

    distance = request.args.get("distance", None)
    input_data, errors = validation.validate_spatial_data(
        input_data={
            "latitude": request.args.get("latitude"),
            "longitude": request.args.get("longitude"),
        }
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    weather_stations = ext.Extract().get_nearest_weather_stations(
        latitude=float(input_data["latitude"]),
        longitude=float(input_data["longitude"]),
        threshold_distance=distance,
    )

    return (
        jsonify(
            dict(message="Operation successful", weather_stations=weather_stations)
        ),
        200,
    )


@extract_bp.route(api.GEO_COORDINATES, methods=["POST"])
def get_geo_coordinates():
    try:
        json_data = request.get_json()

        geo_coordinates = ext.Extract().get_geo_coordinates(
            ip_address=json_data["ip_address"],
        )

        return (
            jsonify(
                dict(message="Operation successful", data=geo_coordinates)
            ),
            200,
        )
    except Exception as ex:
        print(ex)
        return (
            jsonify(
                dict(message="Operation failed", data={})
            ),
            500,
        )


@extract_bp.route(api.GREENNESS_URL, methods=["GET"])
def get_greenness():
    input_params = {
        "latitude": request.args.get("latitude"),
        "longitude": request.args.get("longitude"),
        "start_date": request.args.get("start_date"),
        "end_date": request.args.get("end_date"),
    }
    input_data, errors = validation.validate_inputs(input_data=input_params)

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    greenness = model.get_greenness(
        float(input_data["latitude"]),
        float(input_data["longitude"]),
        input_data["start_date"],
        input_data["end_date"],
    )

    response = dict(message="greenness value returned successfully", data=greenness)
    return jsonify(response), 200


@extract_bp.route(api.ALTITUDE_URL, methods=["GET"])
def get_altitude():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    altitude = model.get_altitude(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(message="altitude value returned successfully", data=altitude)
    return jsonify(response), 200


@extract_bp.route(api.ASPECT_URL, methods=["GET"])
def get_aspect():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_aspect_270(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(message="aspect value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.LANDFORM90_URL, methods=["GET"])
def get_landform90():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_landform90(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(message="landform value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.LANDFORM270_URL, methods=["GET"])
def get_landform270():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_landform270(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(message="landform value returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.BEARING_FROM_KAMPALA_URL, methods=["GET"])
def get_bearing_from_kampala():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    print(input_data)
    model = ext.Extract()
    result = model.get_bearing_from_kampala(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="bearing from kampala value returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_FROM_KAMPALA_URL, methods=["GET"])
def get_distance_from_kampala():
    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_from_kampala(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance from kampala value returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_ROAD_URL, methods=["GET"])
def get_distance_to_closest_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_road(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest road returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_PRIMARY_ROAD_URL, methods=["GET"])
def get_distance_to_closest_primary_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_primary_road(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest primary road returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_SECONDARY_ROAD_URL, methods=["GET"])
def get_distance_to_closest_secondary_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_secondary_road(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest secondary road returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_RESIDENTIAL_ROAD_URL, methods=["GET"])
def get_distance_to_closest_residential_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_residential_road(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest residential road returned successfully",
        data=result,
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_TERTIARY_ROAD_URL, methods=["GET"])
def get_distance_to_closest_tertiary_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_tertiary_road(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest tertiary road returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_TRUNK_ROAD_URL, methods=["GET"])
def get_distance_to_closest_trunk_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_trunk(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest trunk road returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_UNCLASSIFIED_ROAD_URL, methods=["GET"])
def get_distance_to_closest_unclassified_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_unclassified_road(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest unclassified road returned successfully",
        data=result,
    )
    return jsonify(response), 200


@extract_bp.route(api.DISTANCE_CLOSEST_MOTORWAY_ROAD_URL, methods=["GET"])
def get_distance_to_closest_motorway_road():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_distance_to_closest_motorway(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(
        message="distance to closest motorway road returned successfully", data=result
    )
    return jsonify(response), 200


@extract_bp.route(api.LAND_USE_URL, methods=["GET"])
def get_land_use():

    latitude = request.args.get("latitude")
    longitude = request.args.get("longitude")
    input_data, errors = validation.validate_spatial_data(
        input_data={"latitude": latitude, "longitude": longitude}
    )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_landuse(
        float(input_data["latitude"]), float(input_data["longitude"])
    )

    response = dict(message="land_use returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.TAHMO_WEATHER_STATIONS_ACCOUNT_HAS_ACCESS_TO_URL, methods=["GET"])
def get_all_weather_station_account_has_access_on():
    errors = {}
    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_all_weather_station_account_has_access_on()

    response = dict(message="weather stations returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.TAHMO_WEATHER_STATION_VARIABLES_URL, methods=["GET"])
def get_all_available_variables_and_units_tahmo_api():
    errors = {}
    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_all_available_variables_and_units_tahmo_api()

    response = dict(message="weather stations returned successfully", data=result)
    return jsonify(response), 200


@extract_bp.route(api.TAHMO_WEATHER_STATION_MEASUREMENTS_URL, methods=["GET"])
def get_station_measurements():
    errors = {}
    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = ext.Extract()
    result = model.get_station_measurements()

    response = dict(message="weather stations returned successfully", data=result)
    return jsonify(response), 200
