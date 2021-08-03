import json
import requests
from google.cloud import storage
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import os
import gpflow
from gpflow import set_trainable
import geopandas
from config import connect_mongo
from config import configuration
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CREDENTIALS = configuration.CREDENTIALS
storage_client = storage.Client.from_service_account_json(CREDENTIALS)
shapefile_path = os.path.join(BASE_DIR,'shape_files')
kawempe_ids = ['aq_54', 'aq_76', 'aq_94','aq_g507','aq_g508','aq_g509', 'aq_g512', 'aq_91', 'ANQ16PZJ', 'ALS2LCWY', 'AB6051M4', 
'AW66FF7V', 'A743BPWK']

kampala_ids = ['aq_79', 'aq_29', 'aq_69', 'aq_71', 'aq_72', 'aq_68', 'aq_67', 'aq_65', 'aq_61', 'aq_59', 'aq_60', 'aq_63', 'aq_58', 
'aq_56', 'aq_55', 'aq_52', 'aq_53', 'aq_54', 'aq_51', 'aq_47', 'aq_46', 'aq_45', 'aq_44', 'aq_43', 'aq_62', 'aq_39', 'aq_36', 'aq_26',
'aq_30', 'aq_31', 'aq_32', 'aq_48', 'aq_49', 'aq_64', 'aq_66', 'aq_70', 'aq_74'] #maybe add kcca devices

airqloud_dict = {'kampala':kampala_ids, 'kawempe':kawempe_ids}


def get_channels(airqloud_name):
    'returns a list of the channels in a given airqloud'
    return airqloud_dict[airqloud_name]
    

if __name__=='__main__':
    print(get_channels('kampala'))