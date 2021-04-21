import app
from datetime import datetime, timedelta
from config import db_connection
from helpers import convert_date
import requests
import math
from google.cloud import bigquery
import pandas as pd


class DeviceHourlyMeasurements():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_all(self, query, projection):
    """

    """
    tenant = self.tenant
    db = db_connection.connect_mongo(tenant)
    records = db.device_hourly_measurements.aggregate([query, projection])
    return records
