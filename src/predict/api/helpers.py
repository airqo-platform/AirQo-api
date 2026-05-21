import json
import math
from datetime import date, datetime, timedelta
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv
from flask import current_app
from flask import request
from google.cloud import bigquery
from pymongo import errors
from sqlalchemy import func

from app import cache
from config import connect_mongo, connect_site_forecast_mongo, Config

load_dotenv()
db = connect_mongo()
site_forecast_db = connect_site_forecast_mongo()


def date_to_str(date: datetime):
    return date.isoformat()


def serialize_datetime(value: Any):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def clean_response_value(value: Any):
    serialized = serialize_datetime(value)
    try:
        if pd.isna(serialized):
            return None
    except TypeError:
        return serialized
    return serialized


def get_positive_int_query_arg(name: str, default: int, maximum: int | None = None):
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default

    value = max(value, 1)
    if maximum is not None:
        value = min(value, maximum)
    return value


def get_pagination_params(default_limit: int = 10, max_limit: int = 100):
    page = get_positive_int_query_arg("page", default=1)
    limit = get_positive_int_query_arg(
        "limit", default=default_limit, maximum=max_limit
    )
    return {
        "page": page,
        "limit": limit,
        "offset": (page - 1) * limit,
    }


def build_pagination_metadata(page: int, limit: int, total: int):
    return {
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total else 0,
        "total": total,
    }


def get_site_daily_forecast_collection_name():
    """Return the Mongo collection that stores site daily forecast documents."""
    return Config.MONGO_SITE_DAILY_FORECAST_COLLECTION


def get_site_hourly_forecast_collection_name():
    """Return the Mongo collection that stores site hourly forecast documents."""
    return Config.MONGO_SITE_HOURLY_FORECAST_COLLECTION


def get_site_hourly_forecast_horizon_hours():
    try:
        horizon_hours = int(Config.SITE_HOURLY_FORECAST_HORIZON_HOURS or 240)
    except (TypeError, ValueError):
        horizon_hours = 240
    return max(horizon_hours, 1)


def get_site_daily_forecast_cache_version(
    site_id: str | None, start_date: date, days: int = 7
):
    """
    Return a version token for site daily forecast cache keys.

    The token is derived from the latest matching document in the forecast
    collection so cached responses are invalidated when forecast data changes.
    If the collection is empty, return ``empty``. If Mongo is unavailable while
    generating the key, return ``db-unavailable`` so cache-key generation does
    not raise.
    """
    end_date = start_date + timedelta(days=days - 1)
    query = {
        "date": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat(),
        }
    }
    if site_id:
        query["site_id"] = site_id

    try:
        latest_document = (
            site_forecast_db[get_site_daily_forecast_collection_name()]
            .find(query, {"created_at": 1, "date": 1, "site_id": 1})
            .sort([("created_at", -1), ("date", -1), ("site_id", -1)])
            .limit(1)
        )
        latest_document = next(iter(latest_document), None)
    except (errors.ServerSelectionTimeoutError, errors.PyMongoError):
        return "db-unavailable"

    if not latest_document:
        return "empty"

    return (
        clean_response_value(latest_document.get("created_at"))
        or clean_response_value(latest_document.get("date"))
        or "present"
    )


def get_site_hourly_forecast_cache_version(
    site_id: str | None, start_timestamp: datetime, hours: int | None = None
):
    """
    Return a version token for site hourly forecast cache keys.

    The token is derived from the latest matching document in the forecast
    collection so cached responses are invalidated when forecast data changes.
    If Mongo is unavailable while generating the key, return a stable fallback
    token so cache-key generation does not raise.
    """
    hours = hours or get_site_hourly_forecast_horizon_hours()
    end_timestamp = start_timestamp + timedelta(hours=hours - 1)
    query = {
        "timestamp": {
            "$gte": start_timestamp,
            "$lte": end_timestamp,
        }
    }
    if site_id:
        query["site_id"] = site_id

    try:
        latest_document = (
            site_forecast_db[get_site_hourly_forecast_collection_name()]
            .find(query, {"created_at": 1, "timestamp": 1, "site_id": 1})
            .sort([("created_at", -1), ("timestamp", -1), ("site_id", -1)])
            .limit(1)
        )
        latest_document = next(iter(latest_document), None)
    except (errors.ServerSelectionTimeoutError, errors.PyMongoError):
        return "db-unavailable"

    if not latest_document:
        return "empty"

    return (
        clean_response_value(latest_document.get("created_at"))
        or clean_response_value(latest_document.get("timestamp"))
        or "present"
    )


def get_site_daily_forecasts(site_id: str | None, start_date: date, days: int = 7):
    """
    Fetch raw site daily forecast documents for the requested date window.

    When ``site_id`` is provided the result is limited to one site's forecast
    horizon. Otherwise, the result contains documents for all sites in the
    window, sorted by date then site.
    """
    end_date = start_date + timedelta(days=days - 1)
    query = {
        "date": {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat(),
        }
    }
    if site_id:
        query["site_id"] = site_id

    sort_fields = [("date", 1)] if site_id else [("date", 1), ("site_id", 1)]
    cursor = site_forecast_db[get_site_daily_forecast_collection_name()].find(
        query, {"_id": 0}
    ).sort(sort_fields)
    if site_id:
        cursor = cursor.limit(days)
    return list(cursor)


def get_site_hourly_forecasts(
    site_id: str | None,
    start_timestamp: datetime,
    hours: int | None = None,
    page: int = 1,
    limit: int | None = None,
    offset: int | None = None,
):
    """
    Fetch raw site hourly forecast documents for the requested timestamp window.

    When ``site_id`` is provided the result is limited to one site's forecast
    horizon. Otherwise, the result contains documents for all sites in the
    window, sorted by timestamp then site.
    """
    hours = hours or get_site_hourly_forecast_horizon_hours()
    end_timestamp = start_timestamp + timedelta(hours=hours - 1)
    query = {
        "timestamp": {
            "$gte": start_timestamp,
            "$lte": end_timestamp,
        }
    }
    if site_id:
        query["site_id"] = site_id

    collection = site_forecast_db[get_site_hourly_forecast_collection_name()]
    limit = limit or hours
    offset = offset if offset is not None else (page - 1) * limit
    timestamp_query = query.copy()

    sort_fields = [("timestamp", 1)] if site_id else [("timestamp", 1), ("site_id", 1)]
    if site_id:
        total = collection.count_documents(query)
        cursor = (
            collection.find(query, {"_id": 0})
            .sort(sort_fields)
            .skip(offset)
            .limit(limit)
        )
    else:
        site_ids = sorted(
            site_id for site_id in collection.distinct("site_id", query) if site_id
        )
        total = len(site_ids)
        page_site_ids = site_ids[offset : offset + limit]
        if not page_site_ids:
            return (
                [],
                total,
                sorted(collection.distinct("timestamp", timestamp_query)),
            )

        query = {**query, "site_id": {"$in": page_site_ids}}
        cursor = collection.find(query, {"_id": 0}).sort(sort_fields)

    distinct_timestamps = sorted(collection.distinct("timestamp", timestamp_query))
    return list(cursor), total, distinct_timestamps


SITE_FORECAST_UNITS = {
    "pm2_5": "ug/m3",
    "air_temperature": "degC",
    "relative_humidity": "%",
    "air_pressure_at_sea_level": "hPa",
    "precipitation_amount": "mm",
    "cloud_area_fraction": "%",
    "wind_speed": "m/s",
    "wind_from_direction": "degrees",
    "forecast_confidence": "%",
}

SITE_FORECAST_DESCRIPTIONS = {
    "pm2_5_mean": "Predicted average PM2.5 concentration.",
    "pm2_5_low": "Lower PM2.5 forecast estimate.",
    "pm2_5_high": "Upper PM2.5 forecast estimate.",
    "pm2_5_q10": "10th percentile PM2.5 forecast estimate.",
    "pm2_5_q90": "90th percentile PM2.5 forecast estimate.",
    "pm2_5_min": "Minimum predicted PM2.5.",
    "pm2_5_max": "Maximum predicted PM2.5.",
    "forecast_confidence": "Confidence level of the forecast.",
}

SITE_HOURLY_FORECAST_DESCRIPTIONS = {
    "pm2_5_mean": SITE_FORECAST_DESCRIPTIONS["pm2_5_mean"],
    "pm2_5_q10": SITE_FORECAST_DESCRIPTIONS["pm2_5_q10"],
    "pm2_5_q90": SITE_FORECAST_DESCRIPTIONS["pm2_5_q90"],
    "forecast_confidence": SITE_FORECAST_DESCRIPTIONS["forecast_confidence"],
}


def build_site_forecast_response(
    site_id: str | None, aqi_category_getter, wind_direction_formatter
):
    """
    Build the API response payload for ``/api/v2/predict/daily-forecasting``.

    The response is normalized so filtered and unfiltered requests share the
    same outer structure. Each site entry contains ``site_details`` and a list
    of daily forecast rows with forecast, AQI, and meteorology metadata.
    """
    start_date = date.today()
    try:
        forecast_documents = get_site_daily_forecasts(
            site_id=site_id, start_date=start_date
        )
    except errors.ServerSelectionTimeoutError:
        current_app.logger.error(
            "Site daily forecast database connection timed out", exc_info=False
        )
        return {
            "success": False,
            "message": "Site daily forecast database is unavailable.",
            "data": {
                "site_details": None,
                "units": SITE_FORECAST_UNITS,
                "descriptions": SITE_FORECAST_DESCRIPTIONS,
                "forecasts": [],
            },
        }, 503
    except errors.PyMongoError as ex:
        current_app.logger.error(
            "Site daily forecast database query failed: %s", ex, exc_info=False
        )
        return {
            "success": False,
            "message": "Failed to fetch site daily forecasts.",
            "data": {
                "site_details": None,
                "units": SITE_FORECAST_UNITS,
                "descriptions": SITE_FORECAST_DESCRIPTIONS,
                "forecasts": [],
            },
        }, 503
    expected_days = 7

    if not forecast_documents:
        return {
            "success": False,
            "data": {
                "site_details": None,
                "start_date": start_date.isoformat() if site_id else None,
                "end_date": (start_date + timedelta(days=6)).isoformat()
                if site_id
                else None,
                "days": expected_days if site_id else None,
                "units": SITE_FORECAST_UNITS,
                "descriptions": SITE_FORECAST_DESCRIPTIONS,
                "forecasts": [],
            },
        }, 404

    def format_forecast_entry(forecast_document):
        pm2_5_mean = clean_response_value(forecast_document.get("pm2_5_mean"))
        wind_direction_degrees = clean_response_value(
            forecast_document.get("wind_from_direction")
        )
        aqi_category_details = (
            aqi_category_getter(pm2_5_mean) if pm2_5_mean is not None else None
        )

        return {
            "date": clean_response_value(forecast_document.get("date")),
            "site": {
                "site_id": clean_response_value(forecast_document.get("site_id")),
                "site_name": clean_response_value(forecast_document.get("site_name")),
                "site_latitude": clean_response_value(
                    forecast_document.get("site_latitude")
                ),
                "site_longitude": clean_response_value(
                    forecast_document.get("site_longitude")
                ),
                "forecast": {
                    "pm2_5_mean": pm2_5_mean,
                    "pm2_5_low": clean_response_value(
                        forecast_document.get("pm2_5_low")
                    ),
                    "pm2_5_high": clean_response_value(
                        forecast_document.get("pm2_5_high")
                    ),
                    "pm2_5_min": clean_response_value(
                        forecast_document.get("pm2_5_min")
                    ),
                    "pm2_5_max": clean_response_value(
                        forecast_document.get("pm2_5_max")
                    ),
                    "forecast_confidence": clean_response_value(
                        forecast_document.get("forecast_confidence")
                    ),
                },
                "aqi": {
                    "aqi_value": pm2_5_mean,
                    "aqi_category": (
                        aqi_category_details.get("aqi_category")
                        if aqi_category_details
                        else None
                    ),
                    "aqi_color_name": (
                        aqi_category_details.get("aqi_color_name")
                        if aqi_category_details
                        else None
                    ),
                    "aqi_color": (
                        f"#{aqi_category_details['aqi_color'].upper()}"
                        if aqi_category_details
                        else None
                    ),
                },
                "met": {
                    "air_temperature": clean_response_value(
                        forecast_document.get("air_temperature")
                    ),
                    "relative_humidity": clean_response_value(
                        forecast_document.get("relative_humidity")
                    ),
                    "air_pressure_at_sea_level": clean_response_value(
                        forecast_document.get("air_pressure_at_sea_level")
                    ),
                    "precipitation_amount": clean_response_value(
                        forecast_document.get("precipitation_amount")
                    ),
                    "cloud_area_fraction": clean_response_value(
                        forecast_document.get("cloud_area_fraction")
                    ),
                    "wind_speed": clean_response_value(
                        forecast_document.get("wind_speed")
                    ),
                    "wind_from_direction": wind_direction_degrees,
                    "wind_direction_compass": wind_direction_formatter(
                        wind_direction_degrees
                    ),
                },
            },
            "created_at": clean_response_value(forecast_document.get("created_at")),
        }

    def simplify_site_forecast(forecast):
        return {
            "date": forecast.get("date"),
            "forecast": forecast.get("site", {}).get("forecast"),
            "aqi": forecast.get("site", {}).get("aqi"),
            "met": forecast.get("site", {}).get("met"),
            "created_at": forecast.get("created_at"),
        }

    forecasts = [
        format_forecast_entry(forecast_document)
        for forecast_document in (
            forecast_documents[:expected_days] if site_id else forecast_documents
        )
    ]
    distinct_dates = sorted(
        {
            forecast["date"]
            for forecast in forecasts
            if forecast.get("date") is not None
        }
    )
    grouped_forecasts = {}

    for forecast in forecasts:
        site = forecast.get("site", {})
        forecast_site_id = site.get("site_id")
        if forecast_site_id not in grouped_forecasts:
            grouped_forecasts[forecast_site_id] = {
                "site_details": {
                    "site_id": site.get("site_id"),
                    "site_name": site.get("site_name"),
                    "site_latitude": site.get("site_latitude"),
                    "site_longitude": site.get("site_longitude"),
                },
                "start_date": forecast.get("date"),
                "end_date": forecast.get("date"),
                "days": 0,
                "total": 0,
                "forecasts": [],
            }

        grouped_forecasts[forecast_site_id]["forecasts"].append(
            simplify_site_forecast(forecast)
        )
        grouped_forecasts[forecast_site_id]["end_date"] = forecast.get("date")

    for grouped_site_forecast in grouped_forecasts.values():
        grouped_site_forecast["days"] = len(
            {
                site_forecast.get("date")
                for site_forecast in grouped_site_forecast["forecasts"]
                if site_forecast.get("date") is not None
            }
        )
        grouped_site_forecast["total"] = len(grouped_site_forecast["forecasts"])

    return {
        "success": len(forecasts) == expected_days if site_id else True,
        "data": {
            "start_date": distinct_dates[0] if distinct_dates else None,
            "end_date": distinct_dates[-1] if distinct_dates else None,
            "days": len(distinct_dates),
            "total": len(grouped_forecasts),
            "units": SITE_FORECAST_UNITS,
            "descriptions": SITE_FORECAST_DESCRIPTIONS,
            "forecasts": list(grouped_forecasts.values()),
        },
    }, 200


def build_site_hourly_forecast_response(
    site_id: str | None, aqi_category_getter, wind_direction_formatter
):
    """
    Build the API response payload for ``/api/v2/predict/hourly-forecasting``.

    The response mirrors the daily site forecast endpoint while using hourly
    forecast documents produced by ``AirQo-site-HOURLY-forecasting-job_Q``.
    """
    start_timestamp = pd.Timestamp.utcnow().floor("h").to_pydatetime()
    expected_hours = get_site_hourly_forecast_horizon_hours()
    end_timestamp = start_timestamp + timedelta(hours=expected_hours - 1)
    pagination = get_pagination_params(default_limit=10, max_limit=100)
    page = pagination["page"]
    limit = pagination["limit"]

    try:
        forecast_documents = get_site_hourly_forecasts(
            site_id=site_id,
            start_timestamp=start_timestamp,
            hours=expected_hours,
            page=page,
            limit=limit,
            offset=pagination["offset"],
        )
        forecast_documents, total_items, distinct_timestamps = (
            forecast_documents
        )
    except errors.ServerSelectionTimeoutError:
        current_app.logger.error(
            "Site hourly forecast database connection timed out", exc_info=False
        )
        return {
            "success": False,
            "message": "Site hourly forecast database is unavailable.",
            "data": {
                "site_details": None,
                "units": SITE_FORECAST_UNITS,
                "descriptions": SITE_HOURLY_FORECAST_DESCRIPTIONS,
                "forecasts": [],
            },
        }, 503
    except errors.PyMongoError as ex:
        current_app.logger.error(
            "Site hourly forecast database query failed: %s", ex, exc_info=False
        )
        return {
            "success": False,
            "message": "Failed to fetch site hourly forecasts.",
            "data": {
                "site_details": None,
                "units": SITE_FORECAST_UNITS,
                "descriptions": SITE_HOURLY_FORECAST_DESCRIPTIONS,
                "forecasts": [],
            },
        }, 503

    if not forecast_documents:
        pagination_metadata = build_pagination_metadata(
            page=page, limit=limit, total=total_items
        )
        return {
            "success": False,
            "data": {
                "site_details": None,
                "start_timestamp": start_timestamp.isoformat() if site_id else None,
                "end_timestamp": end_timestamp.isoformat() if site_id else None,
                "hours": expected_hours if site_id else None,
                **pagination_metadata,
                "units": SITE_FORECAST_UNITS,
                "descriptions": SITE_HOURLY_FORECAST_DESCRIPTIONS,
                "forecasts": [],
            },
        }, 404

    def format_forecast_entry(forecast_document):
        pm2_5_mean = clean_response_value(forecast_document.get("pm2_5_mean"))
        wind_direction_degrees = clean_response_value(
            forecast_document.get("wind_from_direction")
        )
        aqi_category_details = (
            aqi_category_getter(pm2_5_mean) if pm2_5_mean is not None else None
        )

        return {
            "timestamp": clean_response_value(forecast_document.get("timestamp")),
            "site": {
                "site_id": clean_response_value(forecast_document.get("site_id")),
                "site_name": clean_response_value(forecast_document.get("site_name")),
                "site_latitude": clean_response_value(
                    forecast_document.get("site_latitude")
                ),
                "site_longitude": clean_response_value(
                    forecast_document.get("site_longitude")
                ),
                "forecast": {
                    "pm2_5_mean": pm2_5_mean,
                    "pm2_5_q10": clean_response_value(
                        forecast_document.get("pm2_5_q10")
                    ),
                    "pm2_5_q90": clean_response_value(
                        forecast_document.get("pm2_5_q90")
                    ),
                    "forecast_confidence": clean_response_value(
                        forecast_document.get("forecast_confidence")
                    ),
                },
                "aqi": {
                    "aqi_value": pm2_5_mean,
                    "aqi_category": (
                        aqi_category_details.get("aqi_category")
                        if aqi_category_details
                        else None
                    ),
                    "aqi_color_name": (
                        aqi_category_details.get("aqi_color_name")
                        if aqi_category_details
                        else None
                    ),
                    "aqi_color": (
                        f"#{aqi_category_details['aqi_color'].upper()}"
                        if aqi_category_details
                        else None
                    ),
                },
                "met": {
                    "air_temperature": clean_response_value(
                        forecast_document.get("air_temperature")
                    ),
                    "relative_humidity": clean_response_value(
                        forecast_document.get("relative_humidity")
                    ),
                    "air_pressure_at_sea_level": clean_response_value(
                        forecast_document.get("air_pressure_at_sea_level")
                    ),
                    "precipitation_amount": clean_response_value(
                        forecast_document.get("precipitation_amount")
                    ),
                    "cloud_area_fraction": clean_response_value(
                        forecast_document.get("cloud_area_fraction")
                    ),
                    "wind_speed": clean_response_value(
                        forecast_document.get("wind_speed")
                    ),
                    "wind_from_direction": wind_direction_degrees,
                    "wind_direction_compass": wind_direction_formatter(
                        wind_direction_degrees
                    ),
                },
            },
            "created_at": clean_response_value(forecast_document.get("created_at")),
        }

    def simplify_site_forecast(forecast):
        return {
            "timestamp": forecast.get("timestamp"),
            "forecast": forecast.get("site", {}).get("forecast"),
            "aqi": forecast.get("site", {}).get("aqi"),
            "met": forecast.get("site", {}).get("met"),
            "created_at": forecast.get("created_at"),
        }

    forecasts = [
        format_forecast_entry(forecast_document)
        for forecast_document in forecast_documents
    ]
    grouped_forecasts = {}

    for forecast in forecasts:
        site = forecast.get("site", {})
        forecast_site_id = site.get("site_id")
        if forecast_site_id not in grouped_forecasts:
            grouped_forecasts[forecast_site_id] = {
                "site_details": {
                    "site_id": site.get("site_id"),
                    "site_name": site.get("site_name"),
                    "site_latitude": site.get("site_latitude"),
                    "site_longitude": site.get("site_longitude"),
                },
                "start_timestamp": forecast.get("timestamp"),
                "end_timestamp": forecast.get("timestamp"),
                "hours": 0,
                "total": 0,
                "forecasts": [],
            }

        grouped_forecasts[forecast_site_id]["forecasts"].append(
            simplify_site_forecast(forecast)
        )
        grouped_forecasts[forecast_site_id]["end_timestamp"] = forecast.get(
            "timestamp"
        )

    for grouped_site_forecast in grouped_forecasts.values():
        grouped_site_forecast["hours"] = len(
            {
                site_forecast.get("timestamp")
                for site_forecast in grouped_site_forecast["forecasts"]
                if site_forecast.get("timestamp") is not None
            }
        )
        grouped_site_forecast["total"] = len(grouped_site_forecast["forecasts"])

    grouped_site_forecasts = list(grouped_forecasts.values())
    response_timestamps = [
        forecast.get("timestamp")
        for grouped_site_forecast in grouped_site_forecasts
        for forecast in grouped_site_forecast["forecasts"]
        if forecast.get("timestamp") is not None
    ]
    pagination_metadata = build_pagination_metadata(
        page=page, limit=limit, total=total_items
    )

    return {
        "success": total_items == expected_hours if site_id else True,
        "data": {
            "start_timestamp": (
                response_timestamps[0] if response_timestamps else None
            ),
            "end_timestamp": response_timestamps[-1] if response_timestamps else None,
            "hours": len(distinct_timestamps),
            **pagination_metadata,
            "units": SITE_FORECAST_UNITS,
            "descriptions": SITE_HOURLY_FORECAST_DESCRIPTIONS,
            "forecasts": grouped_site_forecasts,
        },
    }, 200


# Ensure these are updated when the API query parameters are changed
def heatmap_cache_key():
    args = request.args
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    airqloud = args.get("airqloud")
    page = args.get("page")
    limit = args.get("limit")
    return f"{current_hour}_{airqloud}_{page}_{limit}"


def daily_forecasts_cache_key():
    current_day = datetime.now().strftime("%Y-%m-%d")
    args = request.args
    site_name = args.get("site_name")
    region = args.get("region")
    sub_county = args.get("sub_county")
    county = args.get("county")
    district = args.get("district")
    parish = args.get("parish")
    language = args.get("language")
    city = args.get("city")
    site_id = args.get("site_id")
    device_id = args.get("device_id")

    return f"daily_{current_day}_{site_name}_{region}_{sub_county}_{language}_{county}_{district}_{parish}_{city}_{site_id}_{device_id}"


def all_daily_forecasts_cache_key():
    current_day = datetime.now().strftime("%Y-%m-%d")
    return f"all_daily_{current_day}"


def site_daily_forecasts_cache_key():
    """
    Generate the Redis cache key for the site daily forecasting endpoint.

    The key varies by day, optional ``site_id``, and a data-derived cache
    version so stale responses are dropped automatically when source forecast
    documents change.
    """
    current_day = date.today().isoformat()
    site_id = request.args.get("site_id")
    cache_version = get_site_daily_forecast_cache_version(
        site_id=site_id, start_date=date.today()
    )
    return f"site_daily_v7_{current_day}_{site_id}_{cache_version}"


def site_hourly_forecasts_cache_key():
    """
    Generate the Redis cache key for the site hourly forecasting endpoint.

    The key varies by current hour, optional ``site_id``, forecast horizon, and
    a data-derived cache version so source updates invalidate cached responses.
    """
    current_hour = pd.Timestamp.utcnow().floor("h").to_pydatetime()
    site_id = request.args.get("site_id")
    pagination = get_pagination_params(default_limit=10, max_limit=100)
    hours = get_site_hourly_forecast_horizon_hours()
    cache_version = get_site_hourly_forecast_cache_version(
        site_id=site_id,
        start_timestamp=current_hour,
        hours=hours,
    )
    return (
        f"site_hourly_v1_{current_hour.isoformat()}_{hours}_{site_id}_"
        f"{pagination['page']}_{pagination['limit']}_{cache_version}"
    )


def hourly_forecasts_cache_key():
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    args = request.args
    site_name = args.get("site_name")
    region = args.get("region")
    sub_county = args.get("sub_county")
    county = args.get("county")
    district = args.get("district")
    parish = args.get("parish")
    language = args.get("language")
    city = args.get("city")
    site_id = args.get("site_id")
    device_id = args.get("device_id")

    return f"hourly_{current_hour}_{site_name}_{region}_{sub_county}_{county}_{language}_{district}_{parish}_{city}_{site_id}_{device_id}"


def all_hourly_forecasts_cache_key():
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
    return f"all_hourly_{current_hour}"


def get_faults_cache_key():
    args = request.args
    current_hour = datetime.now().strftime("%Y-%m-%d-%H")
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
def get_health_tips(language="") -> list[dict]:
    params = {"language": language} if language else {}
    try:
        response = requests.get(
            f"{Config.AIRQO_BASE_URL}api/v2/devices/tips?token={Config.AIRQO_API_AUTH_TOKEN}",
            timeout=10,
            params=params,
        )
        if response.status_code == 200:
            result = response.json()
            if "tips" in result:
                return result["tips"]
            else:
                raise Exception("Invalid JSON response: no 'tips' key")
        else:
            raise Exception(f"Bad status code: {response.status_code}")
    except Exception as ex:
        current_app.logger.error(
            "Failed to retrieve health tips: %s", ex, exc_info=False
        )
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


# TODO: Delete once mobile app is updated
def get_forecasts_1(
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
        for time, pm2_5 in zip(
            site_forecasts[0]["timestamp"],
            site_forecasts[0]["pm2_5"],
            # site_forecasts[0]["margin_of_error"],
            # site_forecasts[0]["adjusted_forecast"],
        ):
            result = {
                key: value
                for key, value in zip(
                    ["time", "pm2_5"],
                    [time, pm2_5],
                )
            }
            results.append(result)

    formatted_results = {"forecasts": results}
    return formatted_results


@cache.memoize(timeout=Config.CACHE_TIMEOUT)
def get_forecasts_2(
    db_name,
    device_id=None,
    site_id=None,
    site_name=None,
    parish=None,
    county=None,
    city=None,
    district=None,
    region=None,
    all_forecasts=False,
):
    query = {}
    if not all_forecasts:
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
    cursor = db[db_name].find(query, {"_id": 0})

    results = {}
    for forecast in cursor:
        site_id = forecast["site_id"]
        if site_id:
            if site_id not in results:
                results[site_id] = []
            forecast_entry = {
                "time": forecast.get("timestamp"),
                "pm2_5": forecast.get("pm2_5"),
            }
            results[site_id].append(forecast_entry)

    return results


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
            if value not in [0, 1, None]:
                return False, f"Invalid value for {param}: {value}"
    return True, None


def read_faulty_devices():
    devices = []
    try:
        collection = db["faulty_devices_1"]
        devices = list(collection.find({}, {"_id": 0}))
    except errors.ServerSelectionTimeoutError as e:
        current_app.logger.error(
             "Error with database connection: %s", e, exc_info=False
            )
    except errors.PyMongoError as e:
        current_app.logger.error(
            "Error reading faulty devices: %s", e, exc_info=False
            )
        raise Exception("Failed to read faulty devices from the database.")
    return devices


def add_forecast_health_tips(results: dict, language: str = ""):
    health_tips = get_health_tips(language=language)
    if not health_tips:
        return results

    for site_id, forecasts in results.items():
        for forecast in forecasts:
            forecast["health_tips"] = [
                [
                    tip
                    for tip in health_tips
                    if tip["aqi_category"]["max"]
                    >= pm2_5_value
                    >= tip["aqi_category"]["min"]
                ]
                for pm2_5_value in forecast["pm2_5"]
            ]

    return results
