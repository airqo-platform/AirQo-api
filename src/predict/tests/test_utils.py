from google.cloud import storage
from geopy import distance
import json
import pytz
from datetime import datetime
import pandas as pd
from models import datamanagement as dm
import os
from os import makedirs
from os.path import join, isdir, isfile, basename
import numpy as np
import tensorflow as tf
import requests
import pymongo
from pymongo import MongoClient
from dotenv import load_dotenv
load_dotenv()

MET_API_URL= os.getenv("MET_API_UR")
MET_API_CLIENT_ID= os.getenv("MET_API_CLIENT_ID")
MET_API_CLIENT_SECRET =os.getenv("MET_API_CLIENT_SECRET")
MONGO_URI = os.getenv("MONGO_URI")



def test_get_hourly_met_forecasts():

def test_get_location_hourly_weather_forecasts(latitude:float, longitude:float):

def test_load_json_data(full_file_path):

def test_save_json_data(file_name, data_to_save):

def test_checkKey(dict, key)

def test_get_closest_channel(latitude, longitude) -> int:


def test_convert_local_string_date_to_tz_aware_datetime(local_date_string):

def test_string_to_hourly_datetime(my_list):

def test_get_gp_predictions():

def test_str_to_date(st):