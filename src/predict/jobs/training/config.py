import os
from datetime import datetime
import pandas as pd
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

TRAIN_DATE_HOUR_START = pd.to_datetime(os.environ["TRAIN_START_DATE"])

TRAIN_DATE_HOUR_END = pd.to_datetime(
    os.environ.get("TRAIN_END_DATE", datetime.strftime(datetime.now(), '%Y-%m-%d %H:00:00'))
)

# csv
CSV_FORECAST_DATA_PATH = os.environ["CSV_FORECAST_DATA_PATH"] #'Zindi_PM2_5_forecast_datay.csv' # channel_id, created_at, pm_2_5
CSV_METADATA_PATH = os.environ["CSV_METADATA_PATH"] # 'meta.csv'
CSV_BOUNDARY_LAYER_PATH = os.environ["CSV_BOUNDARY_LAYER_PATH"] # 'boundary_layer.csv'

# mongo connection
MONGO_URI = os.environ["MONGO_URI"]
DB_NAME = os.environ["DB_NAME"]
TENANT = os.environ["TENANT"]

PREDICTION_FEATURES = [
    'display',
    'chan_id',
    'subcounty_lookup',
    'parish_lookup',
    'airqo_district',
    'airqo_subcounty',
    'loc_long',
    'loc_lat',
    'loc_altitude',
    'OSM_land_use',
    'landform_alos_90m',
    'landform_alos_270m',
    'aspect',
    'height',
    'road_dist',
    'road_intensity',
    'paved_road',
    'mount',
    'photo',
    'loc_power_suppy',
    'dist_motorway',
    'dist_trunk',
    'dist_primary',
    'dist_secondary',
    'dist_tertiary',
    'dist_unclassified',
    'dist_residential',
    'bearing_kampala',
    'distance_kampala'
]

SITE_FEATURE_MAPPER = [
    'display',
    'channel_id',
    'sub_county',
    'parish',
    'district',
    'sub_county',
    'longitude',
    'latitude',
    'loc_altitude',
    'OSM_land_use',
    'landform_alos_90m',
    'landform_alos_270m',
    'aspect',
    'height',
    'road_dist',
    'road_intensity',
    'paved_road',
    'mount',
    'photo',
    'loc_power_suppy',
    'dist_motorway',
    'dist_trunk',
    'dist_primary',
    'dist_secondary',
    'dist_tertiary',
    'dist_unclassified',
    'dist_residential',
    'bearing_kampala',
    'distance_kampala'
]


def connect_mongo():
    client = MongoClient(MONGO_URI)
    db = client[f'{DB_NAME}_{TENANT.lower()}']
    return db


