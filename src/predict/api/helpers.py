import json
import math
import traceback
from datetime import datetime

import pandas as pd
import requests
from dotenv import load_dotenv
from flask import request
from google.cloud import bigquery
from sqlalchemy import func

from app import cache
from config import connect_mongo, Config

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
    correlation_fault = args.get("correlation_fault")
    missing_data_fault = args.get("missing_data_fault")
    created_at = args.get("created_at")
    return f"{airqloud}_{device_name}_{correlation_fault}_{missing_data_fault}_{created_at}"


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
def get_health_tips() -> list[dict]:
    try:
        response = requests.get(
            f"{Config.AIRQO_BASE_URL}api/v2/devices/tips?token={Config.AIRQO_API_AUTH_TOKEN}",
            timeout=10,
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
def get_parish_predictions(
    parish: str, district: str, page_size: int, offset: int
) -> []:
    from app import postgres_db, Predictions

    query = postgres_db.session.query(
        func.ST_AsGeoJSON(Predictions.geometry).label("geometry"),
        Predictions.parish.label("parish"),
        Predictions.district.label("district"),
        Predictions.timestamp.label("timestamp"),
        Predictions.pm2_5.label("pm2_5"),
    )

    if parish:
        query = query.filter(Predictions.parish.ilike(f"%{parish}%"))

    if district:
        query = query.filter(Predictions.district.ilike(f"%{district}%"))

    parishes = query.limit(page_size).offset(offset).all()

    total_rows = query.count()
    total_pages = math.ceil(total_rows / page_size)

    data = [
        {
            "parish": parish.parish,
            "pm2_5": parish.pm2_5,
            "district": parish.district,
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
        "district": point.district,
        "pm2_5": point.pm2_5,
        "timestamp": point.timestamp,
    }


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_forecasts(
    db_name,
    device_id=None,
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
        "device_id": device_id,
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
        for time, pm2_5, margin_of_error, adjusted_forecast in zip(
            site_forecasts[0]["timestamp"],
            site_forecasts[0]["pm2_5"],
            site_forecasts[0]["margin_of_error"],
            site_forecasts[0]["adjusted_forecast"],
        ):
            result = {
                key: value
                for key, value in zip(
                    ["time", "pm2_5", "margin_of_error", "adjusted_forecast"],
                    [time, pm2_5, margin_of_error, adjusted_forecast],
                )
            }
            results.append(result)

    formatted_results = {"forecasts": results}
    return formatted_results


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def read_predictions_from_db(airqloud=None, page_number=1, limit=1000):
    collection = db.gp_model_predictions

    pipeline = []

    if airqloud:
        pipeline.append({"$match": {"airqloud": airqloud}})

    pipeline.extend(
        [
            {"$unwind": "$values"},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "values": {"$push": "$values"},
                }
            },
            {
                "$project": {
                    "total": 1,
                    "values": {"$slice": ["$values", (page_number - 1) * limit, limit]},
                }
            },
        ]
    )

    result = collection.aggregate(pipeline)

    total = 0
    values = []

    for document in result:
        total = document["total"]
        values = document.get("values", [])

    return values, total


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def convert_to_geojson(values):
    geojson = {"type": "FeatureCollection", "features": []}
    for value in values:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [value["longitude"], value["latitude"]],
            },
            "properties": {
                "pm2_5": value["predicted_value"],
                "variance": value["variance"],
                "interval": value["interval"],
                "latitude": value["latitude"],
                "longitude": value["longitude"],
            },
        }
        geojson["features"].append(feature)
    return geojson


def validate_param_values(params):
    for param in params:
        if param in ["correlation_fault", "missing_data_fault"]:
            value = params[param]
            if value not in ["0", "1"]:
                return False, f"Invalid value for {param}: {value}"
    return True, None


def read_faulty_devices(query):
    collection = db["faulty_devices"]
    docs = collection.find(query).sort("created_at", -1)
    result = []
    for doc in docs:
        doc.pop("_id")
        result.append(doc)
    return result
