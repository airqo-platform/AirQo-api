import json
import math
import traceback
from datetime import datetime

import geojson
import pandas as pd
import requests
from dotenv import load_dotenv
from flask import request
from google.cloud import bigquery
from sqlalchemy import func

from app import cache
from config.constants import connect_mongo, Config
from bson.json_util import dumps

load_dotenv()
db = connect_mongo()


def date_to_str(date: datetime):
    return date.isoformat()


def heatmap_cache_key():
    args = request.args
    airqloud = args.get("airqloud")
    page = args.get("page")
    limit = args.get("limit")
    return f"{airqloud}_{page}_{limit}"


def daily_forecasts_cache_key():
    current_date = datetime.now().strftime("%Y-%m-%d")
    args = request.args
    site_name = args.get("site_name")
    region = args.get("region")
    sub_county = args.get("sub_county")
    county = args.get("county")
    district = args.get("district")
    parish = args.get("parish")
    city = args.get("city")
    site_id = args.get("site_id")

    return f"daily_{current_date}_{site_name}_{region}_{sub_county}_{county}_{district}_{parish}_{city}_{site_id}"


def hourly_forecasts_cache_key():
    current_date = datetime.now().strftime("%Y-%m-%d")
    args = request.args
    site_name = args.get("site_name")
    region = args.get("region")
    sub_county = args.get("sub_county")
    county = args.get("county")
    district = args.get("district")
    parish = args.get("parish")
    city = args.get("city")
    site_id = args.get("site_id")

    return f"hourly_{current_date}_{site_name}_{region}_{sub_county}_{county}_{district}_{parish}_{city}_{site_id}"


def get_faults_cache_key():
    args = request.args
    airqloud = args.get("airqloud")
    device_name = args.get("device_name")
    corelation_fault = args.get("corelation_fault")
    missing_data_fault = args.get("missing_data_fault")
    created_at = args.get("created_at")
    return f"{airqloud}_{device_name}_{corelation_fault}_{missing_data_fault}_{created_at}"


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


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def convert_to_geojson(data):
    """
    converts a list of predictions to geojson format
    """
    features = []
    for record in data:
        point = geojson.Point(
            (record["values"]["longitude"], record["values"]["latitude"])
        )
        feature = geojson.Feature(
            geometry=point,
            properties={
                "latitude": record["values"]["latitude"],
                "longitude": record["values"]["longitude"],
                "predicted_value": record["values"]["predicted_value"],
                "variance": record["values"]["variance"],
                "interval": record["values"]["interval"],
            },
        )
        features.append(feature)

    return geojson.FeatureCollection(features)


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_gp_predictions(airqloud=None, page=1, limit=1000):
    """Returns PM 2.5 predictions for a particular airqloud name or id or all airqlouds."""

    pipeline = [
        {"$sort": {"created_at": -1}},
        {
            "$project": {
                "_id": 0,
                "airqloud_id": 1,
                "airqloud": 1,
                "created_at": 1,
                "values": 1,
            }
        },
        {"$unwind": "$values"},
    ]
    if airqloud:
        pipeline.insert(0, {"$match": {"airqloud": airqloud.lower()}})
        pipeline.insert(
            3,
            {
                "$group": {
                    "_id": {"airqloud_id": "$airqloud_id", "airqloud": "$airqloud"},
                    "doc": {"$first": "$$ROOT"},
                }
            },
        )
        pipeline.insert(4, {"$replaceRoot": {"newRoot": "$doc"}})
        pipeline.extend(
            [
                {
                    "$setWindowFields": {
                        "partitionBy": {
                            "airqloud_id": "$airqloud_id",
                            "airqloud": "$airqloud",
                        }
                        if airqloud
                        else None,
                        "sortBy": {"created_at": 1},
                        "output": {
                            "total": {
                                "$sum": 1,
                                "window": {"documents": ["unbounded", "unbounded"]},
                            }
                        },
                    }
                },
                {"$replaceRoot": {"newRoot": "$doc"}},
                {
                    "$project": {
                        "_id": 0,
                        "airqloud_id": 1,
                        "airqloud": 1,
                        "created_at": 1,
                        "values": 1,
                    }
                },
                {"$unwind": "$values"},
                {
                    "$setWindowFields": {
                        "partitionBy": {
                            "airqloud_id": "$airqloud_id",
                            "airqloud": "$airqloud",
                        },
                        "sortBy": {"created_at": 1},
                        "output": {
                            "total": {
                                "$sum": 1,
                                "window": {"documents": ["unbounded", "unbounded"]},
                            }
                        },
                    }
                },
                {"$skip": (page - 1) * limit},
                {"$limit": limit},
            ]
        )
    predictions = db.gp_predictions.aggregate(pipeline)
    predictions = list(predictions)
    created_at = predictions[0]["created_at"]
    total_count = predictions[0]["total"]
    pages = math.ceil(total_count / limit)
    airqloud_id = predictions[0]["airqloud_id"]
    return airqloud_id, created_at, predictions, total_count, pages


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
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


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
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


def geo_coordinates_cache_key_v2():
    key = (
            "geo_coordinates:"
            + str(round(float(request.args.get("latitude")), 6))
            + ":"
            + str(round(float(request.args.get("longitude")), 6))
    )
    return key


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_parish_predictions(parish_name: str, page_size: int, offset: int) -> []:
    from app import postgres_db, Predictions

    query = postgres_db.session.query(
        func.ST_AsGeoJSON(Predictions.geometry).label("geometry"),
        Predictions.parish.label("parish"),
        Predictions.timestamp.label("timestamp"),
        Predictions.pm2_5.label("pm2_5"),
    )

    if parish_name:
        query = query.filter(Predictions.parish.ilike(f"%{parish_name}%"))

    parishes = query.limit(page_size).offset(offset).all()

    total_rows = query.count()
    total_pages = math.ceil(total_rows / page_size)

    data = [
        {
            "parish": parish.parish,
            "pm2_5": parish.pm2_5,
            "timestamp": parish.timestamp,
            "geometry": json.loads(parish.geometry),
        }
        for parish in parishes
    ]

    return data, total_pages


def get_predictions_by_geo_coordinates_v2(latitude: float, longitude: float) -> dict:
    from app import postgres_db, Predictions

    point = func.ST_MakePoint(longitude, latitude)
    query = postgres_db.session.query(Predictions).filter(
        func.ST_Within(point, Predictions.geometry)
    )
    point = query.first()
    if not point:
        return {}
    return {
        "parish": point.parish,
        "pm2_5": point.pm2_5,
        "timestamp": point.timestamp,
    }


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_forecasts(
        db_name,
        site_id=None,
        site_name=None,
        parish=None,
        county=None,
        city=None,
        district=None,
        region=None,
):
    query = {}
    params = {
        "site_id": site_id,
        "site_name": site_name,
        "parish": parish,
        "county": county,
        "city": city,
        "district": district,
        "region": region,
    }
    for name, value in params.items():
        if value is not None:
            query[name] = value
    site_forecasts = list(
        db[db_name].find(query, {"_id": 0}).sort([("$natural", -1)]).limit(1)
    )

    results = []
    if site_forecasts:
        for time, pm2_5, health_tips in zip(
                site_forecasts[0]["time"],
                site_forecasts[0]["pm2_5"],
                site_forecasts[0]["health_tips"],
        ):
            result = {
                key: value
                for key, value in zip(
                    ["time", "pm2_5", "health_tips"], [time, pm2_5, health_tips]
                )
            }
            results.append(result)
    formatted_results = {"forecasts": results}
    return formatted_results


def validate_params(params):
    # Check if the params are valid
    valid_params = ["airqloud_names", "device_name", "correlation_fault", "missing_fault"]
    for param in params:
        if param not in valid_params:
            return False, f"Invalid parameter: {param}"
        # Check if the fault params are 0 or 1
        if param in ["correlation_fault", "missing_data_fault"]:
            value = params[param]
            if value not in ["0", "1"]:
                return False, f"Invalid value for {param}: {value}"
    return True, None


def read_data(query):
    # Find the documents that match the query and sort them by created_at in descending order
    collection = db["faulty_devices"]
    docs = collection.find(query).sort("created_at", -1)
    # Convert the documents to a list of JSON objects
    result = []
    for doc in docs:
        # Exclude the _id field from the output
        doc.pop("_id")
        result.append(doc)
    return result
