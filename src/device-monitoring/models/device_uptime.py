# device_uptime = {
#    "sensor_one_day": "",
#    "sensor_two_day":"",
#     "battery_voltage":"",
#     device_name: "",
#     channel_id: "",
#     _id: "",
#     uptime: "",
#     created_at: ""
# }

import app
from datetime import datetime, timedelta
from helpers import convert_dates
from config import db_connection
import requests
import math
from google.cloud import bigquery
import pandas as pd


class DeviceUptime():
    """
    """

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_device_uptime(self, device_name, days):
        """
        """
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = list(db.device_uptime.find({}))
        return results
