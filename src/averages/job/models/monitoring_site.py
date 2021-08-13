import app
from datetime import datetime, timedelta
from config import db_connection
from helpers import convert_date
import requests
import math
from google.cloud import bigquery
import pandas as pd


class MonitoringSite():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_monitoring_sites(self):
        """
        """
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = list(db.monitoring_site.find(
            {}, {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 0}))
        return results
