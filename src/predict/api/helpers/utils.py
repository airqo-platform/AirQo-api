from dotenv import load_dotenv
from flask import request, jsonify

from config.constants import connect_mongo
from models.predict import get_forecasts

load_dotenv()
db = connect_mongo()


def get_gp_predictions(airqloud, aq_id, page, limit):
    """ returns pm 2.5 predictions for a particular airqloud name or id with pagination """
    if airqloud:
        query = {'airqloud': airqloud.lower()}
    elif aq_id:
        query = {'airqloud_id': aq_id}
    else:
        query = {}

    projection = {
        '_id': 0,
        'latitude': 1,
        'longitude': 1,
        'predicted_value': 1,
        'variance': 1,
        'interval': 1,
        'airqloud': 1,
        'created_at': 1,
        'airqloud_id': 1,
        'values': 1
    }
    offset = (page - 1) * limit
    records = list(db.gp_predictions.find(query, projection).skip(offset).limit(limit))
    return records


def get_total_count(airqloud, aq_id):
    if airqloud:
        query = {'airqloud': airqloud.lower()}
    elif aq_id:
        query = {'airqloud_id': aq_id}
    else:
        query = {}
    count = db.gp_predictions.count_documents(query)
    return count


def get_total_values(airqloud, aq_id):
    if airqloud:
        query = {'airqloud': airqloud.lower()}
    elif aq_id:
        query = {'airqloud_id': aq_id}
    else:
        query = {}
    record = db.gp_predictions.find_one(query)
    if record:
        return len(record['values'])
    else:
        return 0


def get_forecasts_helper(db_name):
    """
    Helper function to get forecasts for a given site_id and db_name
    """
    if request.method == 'GET':
        site_id = request.args.get('site_id')
        if site_id is None or not isinstance(site_id, str):
            return jsonify({"message": "Please specify a site_id", "success": False}), 400
        if len(site_id) != 24:
            return jsonify({"message": "Please enter a valid site_id", "success": False}), 400
        result = get_forecasts(site_id, db_name)
        if result:
            response = result
        else:
            response = {
                "message": "forecasts for this site are not available", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


if __name__ == '__main__':
    print('main')
