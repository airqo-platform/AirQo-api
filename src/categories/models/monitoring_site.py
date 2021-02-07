import app
from datetime import datetime, timedelta
from helpers import convert_date
from config import db_connection, constants
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

    # get monitoring site infromation

    def get_all(self):
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = list(db.monitoring_site.find(
            {"Organisation": tenant}))
        return results
