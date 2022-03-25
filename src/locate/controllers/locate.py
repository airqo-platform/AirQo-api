from flask import Blueprint, request, jsonify
from helpers import helper
import sys, ast, json, logging
from models.parishes import Parish
from models.map import Map
import routes
from flask_caching import Cache
from pymongo import MongoClient
from config import configuration


_logger = logging.getLogger(__name__)

locate_blueprint = Blueprint('locate_blueprint', __name__)
cache = Cache(config={'CACHE_TYPE': 'simple'})

client = MongoClient(configuration.MONGO_URI)
dbs = client.list_database_names()


@locate_blueprint.route(routes.PARISHES, methods=['DELETE', 'GET', 'PUT', 'PATCH', 'POST'])
def place_sensors_map():
    '''
    Returns parishes recommended by the model given the polygon and must-have coordinates
    '''
    if request.method == 'POST':
        json_data = request.get_json()
        
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        org = f'{configuration.DB_NAME}_{tenant.lower()}'
        if org not in dbs:
           return jsonify({"message": "organization doesn't exist. Refer to the API documentation for details.", "success": False}), 400        
        if not json_data:
            return {'message': 'missing request body: sensor_number, must_have_coordinates, polygon. please refer to API documentation for details'}, 400
        else: 
            try:
                sensor_number = int(json_data["sensor_number"])

                polygon = json_data["polygon"]
                if polygon == {}:
                    return jsonify({'message': 'Please draw a polygon'}), 200
                geometry = polygon["geometry"]["coordinates"]

                must_have_coordinates = json_data["must_have_coordinates"]
            except KeyError as err:
                return {'message': f'missing parameter: {str(err)}. please refer to API documentation for details', 'success': False}, 400
            except Exception as err:
                return {'message': f'Some errors occurred: {str(err)}', 'success': False}, 400
            if must_have_coordinates == "":
                must_have_coordinates = None
                return helper.recommend_locations(sensor_number, must_have_coordinates, geometry, tenant)
            else:
                try:
                    must_have_coordinates = ast.literal_eval(must_have_coordinates)
                except:
                    print('EXCEPTION')
                    return {'message': 'Coordinates must be in the form [[long, lat], [long, lat]]'}, 200
                try:
                    if all(isinstance(x, list) for x in must_have_coordinates):
                        return helper.recommend_locations(sensor_number, must_have_coordinates, geometry, tenant)
                except (ValueError, TypeError) as err:
                    return {'message': f'invalid input for parameter: must_have_coordinates. please refer to the API documentation', 'success': False}, 400

                
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@locate_blueprint.route(routes.CREATE_MAP, methods=['DELETE', 'GET', 'PUT', 'PATCH', 'POST'])
def create_locate_map():
    '''
    create planning space
    '''
    errors = {}

    if request.method == 'POST':
        try:
            tenant = request.args.get('tenant')
        except Exception:
            errors['tenant'] = 'This query param is required.'\
                               'please specify the organization name.'

        try:
            id = str(request.json.get('id'))
        except Exception:
            errors['id'] = 'This field is required.'\
                            'please enter a valid str(user id).'
        
        try:
            name = str(request.json.get('name'))
        except Exception:
            errors['name'] = 'This field is required.'\
                            'please enter a valid str(planning space name).'
    
        try:
            plan = request.json.get('plan')
        except Exception:
            errors['plan'] = 'This field is required.'\
                            'Please check the request body.'

        if request.content_type != 'application/json':
            errors['content_type'] = "Invalid content type. Please use json"


        org = f'{configuration.DB_NAME}_{tenant.lower()}'
        if org not in dbs:
            errors['org'] = 'organization does not exist.'\
                            'Refer to the API documentation for details.'
        
        
        if errors:
            return jsonify({
                'message': 'Some errors occurred while processing this request',
                'errors': errors
            }), 400
        
        locate_map = Map(tenant)
        if locate_map.plan_space_exist(id, name) > 0:
            return jsonify({'message': f'planning space name: {name} already exist for user: {id}', "success": False}), 400
        
        locate_map.create_locate_map(id, name, plan)
        return jsonify({'message': 'Locate Planning Space Saved Successfully', 'success': True}), 200
    else:
        return jsonify({'message': 'Invalid request method. Please refer to the API documentation', 'success': False}), 400



@locate_blueprint.route(routes.GET_MAP, methods=['DELETE', 'GET', 'PUT', 'PATCH', 'POST'])
def get_locate_map():
    '''
    Get saved planning space for a specific user
    '''
    errors = {}
    if request.method == 'GET':
        try:
            tenant = request.args.get('tenant')
        except Exception:
            errors['tenant'] = 'This query param is required. '\
                               'please specify the organization name.'
        try:
            id = request.args.get('id')
        except Exception:
            errors['id'] = 'This query param is required.'\
                            'please enter a valid str(user id).'
                            
        org = f'{configuration.DB_NAME}_{tenant.lower()}'
        if org not in dbs:
            errors['org'] = 'organization does not exist.'\
                            'Refer to the API documentation for details.'
        
        if errors:
            return jsonify({
                'message': 'Some errors occurred while processing this request',
                'errors': errors
            }),400 

        locate_map = Map(tenant)
        documents = locate_map.get_locate_map(id)
       
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        if len(response) == 0:
            return jsonify({'message': 'No record available. please check the user_id or organization name.', 
                            'success': False
                            }), 400
        else:
            return jsonify(response), 200
    else:
        return jsonify({'message': 'Invalid request method. please refer to the API documentation', 
                        'success': False
                        }), 400


@locate_blueprint.route(routes.UPDATE_MAP, methods=['DELETE', 'GET', 'PUT', 'PATCH', 'POST'])
def update_locate_map():
    '''
    updates a previously saved planning space
    @param: space_name
    @return: message: <MESSAGE> , status: <BOOLEAN>
    '''
    errors = {}
    if request.method == 'PUT':
        try:

            try:
                tenant = request.args.get('tenant')
            except Exception:
                errors['tenant'] = 'This query param is required.'\
                                'please specify the organization name.'

            try:
                id = request.args.get('id')
            except Exception:
                errors['id'] = 'This query param is required.'\
                                'please enter a valid str(user id).'
            
            try:
                name = request.args.get('name')
            except Exception:
                errors['name'] = 'This query param is required.'\
                                'please enter a valid str(planning space name).'
        
            try:
                plan = request.json.get('plan')
            except Exception:
                errors['plan '] = 'This field is required.'\
                                'Please check the request body.'

            org = f'{configuration.DB_NAME}_{tenant.lower()}'
            if org not in dbs:
                errors['org'] = 'organization does not exist.'\
                                'Refer to the API documentation for details.'
            
            if errors:
                return jsonify({
                    'message': 'Some errors occurred while processing this request',
                    'errors': errors
                }),400 

            locate_map = Map(tenant)
            updated = locate_map.update_locate_map(id, name, plan)

            if updated.modified_count > 0:
                return jsonify({'message': f'planning space {name} updated successfully', 
                                'success': True
                                }), 200
            else:
                return jsonify({'message': 'planning space NOT update. please make sure the plan name or request body is correct', 
                                'success': False
                                }), 404
        except:
            return jsonify({'message': 'errors occured while trying to update planning space', 
                            'success': False
                            }), 500
    else:
       return jsonify({'message': 'Invalid request method. Please refer to the API documentation',
                        'success': False
                        }), 400
 

@locate_blueprint.route(routes.DELETE_MAP, methods=['DELETE', 'GET', 'PUT', 'PATCH', 'POST'])
def delete_locate_map():
    '''
    delete a previously saved planning space
    @param: space_name
    @return: null
    '''
    errors = {}
    if request.method == 'DELETE':
        try:
            tenant = request.args.get('tenant')
        except Exception:
            errors['tenant'] = 'This query param is required.'\
                            'please specify the organization name.'

        try:
            id = request.args.get('id')
        except Exception:
            errors['id'] = 'This query param is required.'\
                            'please enter a valid str(user id).'
        
        try:
            name = request.args.get('name')
        except Exception:
            errors['name'] = 'This query param is required.'\
                            'please enter a valid str(planning space name).'
        
        org = f'{configuration.DB_NAME}_{tenant.lower()}'
        if org not in dbs:
            errors['org'] = 'organization does not exist.'\
                            'Refer to the API documentation for details.'
        
        if errors:
                return jsonify({
                    'message': 'Some errors occurred while processing this request',
                    'errors': errors
                }),400 
        locate_map = Map(tenant)
        result = locate_map.delete_locate_map(id, name)
        if result.deleted_count == 1:
            response = {'message': 'planning space deleted successfully', 
                        'success': True
                        }
            return jsonify(response), 200
        else:
            response = {'message': 'Some erorr occurred, please check the user id and planning space name', 
                        'success': False
                        }
            return jsonify(response), 400

    else:
        return jsonify({"message": "Invalid request method", 
                        "success": False
                        }), 400