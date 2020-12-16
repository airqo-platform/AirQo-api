# network_uptime = {
#     network_name: "",
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


class NetworkUptime():
    """
    """

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_network_uptime(self, network_name, days):
        """
        """
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = list(db.network_uptime.find(
            {'network_name': network_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_network_uptime(self, records):
        """
        """
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = db.network_uptime.insert_many(records)
        return results
