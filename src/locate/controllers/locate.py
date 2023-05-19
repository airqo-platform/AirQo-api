from flask import Blueprint, request, jsonify
from helpers import helper
import sys, ast, json, logging
from models.parishes import Parish
from models.map import Map
import routes
from flask_caching import Cache
from pymongo import MongoClient
from config import configuration
from models.administrative_level import AdminLevel


_logger = logging.getLogger(__name__)

locate_blueprint = Blueprint("locate_blueprint", __name__)
cache = Cache(config={"CACHE_TYPE": "simple"})

client = MongoClient(configuration.MONGO_URI)
dbs = client.list_database_names()


@locate_blueprint.route(
    routes.RECOMMEND, methods=["DELETE", "GET", "PUT", "PATCH", "POST"]
)
def recommend_sensor_placement():
    """
    Returns administrative levels recommended by the model given the polygon and must-have coordinates
    """
    errors = {}
    if request.method == "POST":
        json_data = request.get_json()
        tenant = request.args.get("tenant")

        if tenant is None or tenant == "":
            errors["tenant"] = (
                "This query param is required. " "Please specify the organization name."
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

        if not json_data:
            return {
                "message": "missing request body: sensor_number, must_have_coordinates, polygon. please refer to API documentation for details"
            }, 400
        else:
            try:
                sensor_number = int(json_data["sensor_number"])

                polygon = json_data["polygon"]
                if polygon == {}:
                    return jsonify({"message": "Please draw a polygon"}), 200
                geometry = polygon["geometry"]["coordinates"]

                must_have_coordinates = json_data["must_have_coordinates"]
            except KeyError as err:
                return {
                    "message": f"missing parameter: {str(err)}. please refer to API documentation for details",
                    "success": False,
                }, 400
            except Exception as err:
                return {
                    "message": f"Some errors occurred: {str(err)}",
                    "success": False,
                }, 400
            if must_have_coordinates == "":
                must_have_coordinates = None
                return helper.recommend_locations_for_sensor_placement(
                    sensor_number, must_have_coordinates, geometry, tenant
                )
            else:
                try:
                    must_have_coordinates = ast.literal_eval(must_have_coordinates)
                except:
                    print("EXCEPTION")
                    return {
                        "message": "Coordinates must be in the form [[long, lat], [long, lat]]"
                    }, 200
                try:
                    if all(isinstance(x, list) for x in must_have_coordinates):
                        return helper.recommend_locations_for_sensor_placement(
                            sensor_number, must_have_coordinates, geometry, tenant
                        )
                except (ValueError, TypeError) as err:
                    return {
                        "message": f"Invalid input for parameter: must_have_coordinates. please refer to the API documentation",
                        "success": False,
                    }, 400

    else:
        return (
            jsonify(
                {
                    "message": "Invalid request method. Please refer to the API documentation",
                    "success": False,
                }
            ),
            400,
        )


@locate_blueprint.route(routes.LIST_ADMINLEVELS, methods=["GET"])
def get_admin_level_data():
    """'"""
    if request.method == "GET":
        admin_level_instance = AdminLevel(tenant="airqo")
        result = admin_level_instance.get_sample_location_data()
        if result:
            response = result
        else:
            response = {"message": "Admin level data not available", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@locate_blueprint.route(
    routes.PARISHES, methods=["DELETE", "GET", "PUT", "PATCH", "POST"]
)
def place_sensors_map():
    """
    Returns parishes recommended by the model given the polygon and must-have coordinates
    """
    errors = {}
    if request.method == "POST":
        json_data = request.get_json()
        tenant = request.args.get("tenant")

        if tenant is None or tenant == "":
            errors["tenant"] = (
                "This query param is required. " "Please specify the organization name."
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

        if not json_data:
            return {
                "message": "missing request body: sensor_number, must_have_coordinates, polygon. please refer to API documentation for details"
            }, 400
        else:
            try:
                sensor_number = int(json_data["sensor_number"])

                polygon = json_data["polygon"]
                if polygon == {}:
                    return jsonify({"message": "Please draw a polygon"}), 200
                geometry = polygon["geometry"]["coordinates"]

                must_have_coordinates = json_data["must_have_coordinates"]
            except KeyError as err:
                return {
                    "message": f"missing parameter: {str(err)}. please refer to API documentation for details",
                    "success": False,
                }, 400
            except Exception as err:
                return {
                    "message": f"Some errors occurred: {str(err)}",
                    "success": False,
                }, 400
            if must_have_coordinates == "":
                must_have_coordinates = None
                return helper.recommend_locations(
                    sensor_number, must_have_coordinates, geometry, tenant
                )
            else:
                try:
                    must_have_coordinates = ast.literal_eval(must_have_coordinates)
                except:
                    print("EXCEPTION")
                    return {
                        "message": "Coordinates must be in the form [[long, lat], [long, lat]]"
                    }, 200
                try:
                    if all(isinstance(x, list) for x in must_have_coordinates):
                        return helper.recommend_locations(
                            sensor_number, must_have_coordinates, geometry, tenant
                        )
                except (ValueError, TypeError) as err:
                    return {
                        "message": f"Invalid input for parameter: must_have_coordinates. please refer to the API documentation",
                        "success": False,
                    }, 400

    else:
        return (
            jsonify(
                {
                    "message": "Invalid request method. Please refer to the API documentation",
                    "success": False,
                }
            ),
            400,
        )


@locate_blueprint.route(
    routes.CREATE_MAP, methods=["DELETE", "GET", "PUT", "PATCH", "POST"]
)
def create_locate_map():
    """
    create planning space
    """
    errors = {}

    if request.method == "POST":

        tenant = request.args.get("tenant")
        userId = request.json.get("userId")
        spaceName = request.json.get("spaceName")
        plan = request.json.get("plan")

        if tenant is None or tenant == "":
            errors["tenant"] = (
                "This query param is required." "Please specify the organization name."
            )
        else:
            org = f"{configuration.DB_NAME}_{tenant.lower()}"
            if org not in dbs:
                errors["tenant"] = (
                    "organization does not exist. "
                    "Refer to the API documentation for details."
                )
        if userId is None or userId == "":
            errors["userId"] = (
                "This field is required. " "Please enter a valid str(userId)."
            )
        if spaceName is None or spaceName == "":
            errors["spaceName"] = (
                "This field is required. " "Please enter a valid str(spaceName)."
            )
        if plan is None or plan == "":
            errors["plan"] = "This field is required. " "Please check the request body."

        if request.content_type != "application/json":
            errors["content"] = (
                f"Invalid content type. Expected json but got {request.content_type}. "
                "Please check the request body."
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

        locate_map = Map(tenant)
        if locate_map.plan_space_exist(userId, spaceName) > 0:
            return (
                jsonify(
                    {
                        "message": f"planning space name: {spaceName} already exist for user: {userId}",
                        "success": False,
                    }
                ),
                400,
            )

        locate_map.create_locate_map(userId, spaceName, plan)
        return (
            jsonify({"message": "Planning space saved successfully", "success": True}),
            200,
        )
    else:
        return (
            jsonify(
                {
                    "message": "Invalid request method. Please refer to the API documentation",
                    "success": False,
                }
            ),
            400,
        )


@locate_blueprint.route(
    routes.GET_MAP, methods=["DELETE", "GET", "PUT", "PATCH", "POST"]
)
def get_locate_map():
    """
    Get saved planning space for a specific user
    """
    errors = {}
    if request.method == "GET":

        tenant = request.args.get("tenant")
        userId = request.args.get("userId")
        spaceName = request.args.get("spaceName")

        if tenant is None or tenant == "":
            errors["tenant"] = (
                "This query param is required. " "Please specify the organization name."
            )
        else:
            org = f"{configuration.DB_NAME}_{tenant.lower()}"
            if org not in dbs:
                errors["tenant"] = (
                    "Organization does not exist."
                    " Refer to the API documentation for details."
                )
        if userId is None or userId == "":
            errors["userId"] = (
                "This query param is required. " "Please enter a valid str(userId)."
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

        locate_map = Map(tenant)
        if spaceName is not None:
            documents = locate_map.get_locate_map(userId, spaceName)
        else:
            documents = locate_map.get_locate_map(userId)

        response = []
        for document in documents:
            print(document)
            document["_id"] = str(document["_id"])
            response.append(document)
        if len(response) == 0:
            return (
                jsonify(
                    {
                        "message": "No record available. Please check the userId or organization name.",
                        "success": False,
                    }
                ),
                400,
            )
        else:
            return jsonify(response), 200
    else:
        return (
            jsonify(
                {
                    "message": "Invalid request method. Please refer to the API documentation",
                    "success": False,
                }
            ),
            400,
        )


@locate_blueprint.route(
    routes.UPDATE_MAP, methods=["DELETE", "GET", "PUT", "PATCH", "POST"]
)
def update_locate_map():
    """
    updates a previously saved planning space
    @param: spaceName
    @return: message: <MESSAGE> , status: <BOOLEAN>
    """
    errors = {}
    if request.method == "PUT":
        tenant = request.args.get("tenant")
        userId = request.args.get("userId")
        spaceName = request.args.get("spaceName")
        plan = request.json.get("plan")

        if tenant is None or tenant == "":
            errors["tenant"] = (
                "This query param is required. " "Please specify the organization name."
            )
        else:
            org = f"{configuration.DB_NAME}_{tenant.lower()}"
            if org not in dbs:
                errors["tenant"] = (
                    "organization does not exist."
                    " Refer to the API documentation for details."
                )
        if userId is None or userId == "":
            errors["userId"] = (
                "This query param is required. " "Please enter a valid str(userId)."
            )
        if spaceName is None or spaceName == "":
            errors["spaceName"] = (
                "This query param is required. " "Please enter a valid str(spaceName)."
            )
        if plan is None or plan == "":
            errors["plan"] = "This field is required and can not be empty."

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

        locate_map = Map(tenant)
        if locate_map.plan_space_exist(userId, spaceName) == 0:
            return (
                jsonify(
                    {
                        "message": f"planning space name: {spaceName} doesnot exist for user: {userId}",
                        "success": False,
                    }
                ),
                400,
            )

        updated = locate_map.update_locate_map(userId, spaceName, plan)

        if updated.modified_count == 1:
            return (
                jsonify(
                    {
                        "message": f"planning space: {spaceName} is updated successfully",
                        "success": True,
                    }
                ),
                200,
            )
        if updated.modified_count == 0:
            return (
                jsonify(
                    {
                        "message": "planning space was NOT update because nothing has changed.",
                        "success": True,
                    }
                ),
                200,
            )
        else:
            return (
                jsonify(
                    {
                        "message": "Some errors occurred while processing this request",
                        "success": False,
                    }
                ),
                404,
            )
        # except:
        #     return jsonify({'message': 'errors occured while trying to update planning space',
        #                     'success': False
        #                     }), 500
    else:
        return (
            jsonify(
                {
                    "message": "Invalid request method. Please refer to the API documentation",
                    "success": False,
                }
            ),
            400,
        )


@locate_blueprint.route(
    routes.DELETE_MAP, methods=["DELETE", "GET", "PUT", "PATCH", "POST"]
)
def delete_locate_map():
    """
    delete a previously saved planning space
    @param: space_spaceName
    @return: null
    """
    errors = {}
    if request.method == "DELETE":
        tenant = request.args.get("tenant")
        userId = request.args.get("userId")
        spaceName = request.args.get("spaceName")

        if tenant is None:
            errors["tenant"] = (
                "This query param is required. " "Please specify the organization name."
            )
        else:
            org = f"{configuration.DB_NAME}_{tenant.lower()}"
            if org not in dbs:
                errors["tenant"] = (
                    "organization does not exist. "
                    "Refer to the API documentation for details."
                )
        if userId is None:
            errors["userId"] = (
                "This query param is required. " "Please enter a valid str(userId)."
            )
        if spaceName is None:
            errors["spaceName"] = (
                "This query param is required. " "Please enter a valid str(spaceName)."
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

        locate_map = Map(tenant)
        result = locate_map.delete_locate_map(userId, spaceName)
        if result.deleted_count == 1:
            response = {
                "message": "planning space deleted successfully",
                "success": True,
            }
            return jsonify(response), 200
        else:
            response = {
                "message": "Some erorr occurred, please check the userId and spaceName",
                "success": False,
            }
            return jsonify(response), 400

    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400
