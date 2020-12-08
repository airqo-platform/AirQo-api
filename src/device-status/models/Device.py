import app
from datetime import datetime, timedelta
from helpers import convert_dates
from config import db_connection
import requests
import math
from google.cloud import bigquery
import pandas as pd
from ..config import db_connection


class Device():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self):
        """ initialize """

    # get device status infromation
    def get_devices(self, tenant):
        db = db_connection.connect_mongo(tenant)
        documents = db.devices.find(
            {{"locationID": {'$ne': ''}}, {'_id': 0})
        return documents


if __name__ == "__main__":
    dx = Device()
