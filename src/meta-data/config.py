import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from flasgger import Swagger, LazyString
from flask import request

env_path = Path(".") / ".env"
load_dotenv(dotenv_path=env_path, verbose=True)


class Config:
    # APIs
    BASE_URL_V2 = "/api/v2/meta-data"
    BASE_URL_V1 = "/api/v1/meta-data"

    TAHMO_API_BASE_URL = os.getenv("TAHMO_API_BASE_URL")
    TAHMO_API_MAX_PERIOD = os.getenv("TAHMO_API_MAX_PERIOD")
    TAHMO_API_CREDENTIALS_USERNAME = os.getenv("TAHMO_API_CREDENTIALS_USERNAME")
    TAHMO_API_CREDENTIALS_PASSWORD = os.getenv("TAHMO_API_CREDENTIALS_PASSWORD")

    MOBILE_CARRIER_LOOK_UP_API_KEY = os.getenv("MOBILE_CARRIER_LOOK_UP_API_KEY")

    DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")

    GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    GOOGLE_APPLICATION_CREDENTIALS_EMAIL = os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS_EMAIL"
    )
    GOOGLE_MAP_API_KEY = os.getenv("GOOGLE_MAP_API_KEY")

    ELEVATION_BASE_URL = os.getenv("ELEVATION_BASE_URL")
    WEATHER_STATION_AIRQUALITY_SITE_DISTANCE_THRESHOLD = os.getenv(
        "WEATHER_STATION_AIRQUALITY_SITE_DISTANCE_THRESHOLD"
    )
    CENTER_OF_KAMPALA_LATITUDE = os.getenv("CENTER_OF_KAMPALA_LATITUDE")
    CENTER_OF_KAMPALA_LONGITUDE = os.getenv("CENTER_OF_KAMPALA_LONGITUDE")
    SWAGGER_CONFIG = {
        **Swagger.DEFAULT_CONFIG,
        **{"specs_route": f"{BASE_URL_V2}/apidocs/"},
    }
    SWAGGER_TEMPLATE = {
        "swagger": "2.0",
        "info": {
            "title": "Meta Data API",
            "description": "API docs for Meta Data AirQo microservice",
            "version": "0.0.1",
            "contact": {
                "responsibleOrganization": "AirQo",
                "responsibleDeveloper": "AirQo Engineering",
                "email": "data@airqo.net",
                "url": "https://airqo.africa",
            },
            "termsOfService": "https://airqo.africa/terms",
        },
        "host": LazyString(lambda: request.host),  # overrides localhost:5000
        "schemes": [LazyString(lambda: "https" if request.is_secure else "http")],
        "basePath": f"{BASE_URL_V2}",  # base bash for blueprint registration
        "head_text": "<style>.top_text{color: red;}</style>",
        "doc_expansion": "list",
        "ui_params": {
            "apisSorter": "alpha",
            "operationsSorter": "alpha",
        },
        "url_prefix": f"{BASE_URL_V2}",
        "footer_text": f"&copy; AirQo. {datetime.now().year}",
        "swaggerUiPrefix": LazyString(
            lambda: request.environ.get("HTTP_X_SCRIPT_NAME", "")
        ),
    }

    # AirQo
    AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL")
    AIRQO_API_KEY = os.getenv("AIRQO_API_KEY")

    # Message broker configurations
    SITES_TOPIC = os.getenv("SITES_TOPIC")
    BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
