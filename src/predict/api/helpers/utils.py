import traceback
from datetime import datetime, timedelta

import pandas as pd
import requests
from dotenv import load_dotenv
from flask import request, jsonify
from google.cloud import bigquery
import geojson
from app import cache
from config.constants import connect_mongo, Config
from models.predict import get_forecasts

load_dotenv()
db = connect_mongo()


def date_to_str(date: datetime):
    return date.isoformat()


def convert_to_geojson(data):
    """
    converts a list of predictions to geojson format
    """
    features = []
    for record in data:
        point = geojson.Point((record['values']['latitude'], record['values']['latitude']))
        feature = geojson.Feature(geometry=point, properties={
            "predicted_value": record['values']["predicted_value"],
            "variance": record['values']["variance"],
            "interval": record['values']["interval"]
        })
        features.append(feature)

    return geojson.FeatureCollection(features)


def get_gp_predictions(airqloud=None, page=1, limit=500):
    """Returns PM 2.5 predictions for a particular airqloud name or id."""

    pipeline = [
        {"$match": {"airqloud": airqloud.lower()} if airqloud else {}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "airqloud_id": "$airqloud_id",
                "airqloud": "$airqloud"
            },
            "doc": {"$first": "$$ROOT"}
        }},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$project": {
            '_id': 0,
            'airqloud_id': 1,
            'airqloud': 1,
            'created_at': 1,
            'values': 1
        }},
        {"$unwind": "$values"}
    ]
    result = db.gp_predictions.aggregate(pipeline)
    predictions = list(result)
    total_count = len(predictions)
    paginated_results = predictions[(page - 1) * limit:page * limit]
    return paginated_results, total_count
    # return predictions, total_count


def geo_coordinates_cache_key():
    key = (
            "geo_coordinates:"
            + str(round(float(request.args.get("latitude")), 6))
            + ":"
            + str(round(float(request.args.get("longitude")), 6))
            + ":"
            + str(request.args.get("distance_in_metres"))
    )
    return key


@cache.memoize(timeout=3600)
def get_health_tips() -> list[dict]:
    try:
        response = requests.get(
            f"{Config.AIRQO_BASE_URL}/api/v2/devices/tips?token={Config.AIRQO_API_AUTH_TOKEN}",
            timeout=3,
        )
        result = response.json()
        return result["tips"]
    except Exception as ex:
        print(ex)
        traceback.print_exc()
        cache.delete_memoized(get_health_tips)
        return []


@cache.cached(timeout=3600, key_prefix=geo_coordinates_cache_key)
def get_predictions_by_geo_coordinates(
        latitude: float, longitude: float, distance_in_metres: int
) -> dict:
    client = bigquery.Client()

    query = (
        f"SELECT pm2_5, timestamp, pm2_5_confidence_interval "
        f"FROM `{Config.BIGQUERY_MEASUREMENTS_PREDICTIONS}` "
        f"WHERE ST_DISTANCE(location, ST_GEOGPOINT({longitude}, {latitude})) <= {distance_in_metres} "
        f"ORDER BY pm2_5_confidence_interval "
        f"LIMIT 1"
    )
    dataframe = client.query(query=query).result().to_dataframe()

    if dataframe.empty:
        return {}

    dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
    dataframe["timestamp"] = dataframe["timestamp"].apply(date_to_str)
    dataframe.drop_duplicates(keep="first", inplace=True)

    data = dataframe.to_dict("records")[0]

    return data


def get_forecasts_helper(db_name):
    """
    Helper function to get forecasts for a given site_id and db_name
    """
    if request.method == "GET":
        site_id = request.args.get("site_id")
        if site_id is None or not isinstance(site_id, str):
            return (
                jsonify({"message": "Please specify a site_id", "success": False}),
                400,
            )
        if len(site_id) != 24:
            return (
                jsonify({"message": "Please enter a valid site_id", "success": False}),
                400,
            )
        result = get_forecasts(site_id, db_name)
        if result:
            response = result
        else:
            response = {
                "message": "forecasts for this site are not available",
                "success": False,
            }
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400
