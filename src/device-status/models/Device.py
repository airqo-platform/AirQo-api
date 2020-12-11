import app
from datetime import datetime, timedelta
from helpers import convert_dates
from config import db_connection
import requests
import math
from google.cloud import bigquery
import pandas as pd
from config import db_connection


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
            {})
        return documents
# {"locationID": {'$ne': ''}}, {'_id': 0}

    # get devices status infromation
    def get_device_power(self, tenant):
        db = db_connection.connect_mongo(tenant)
        documents = db.devices.find({'$and': [{'locationID': {'$ne': ""}}, {'status': {'$ne': "Retired"}}, {'power': {'$ne': ""}}]}, {
                                    'power': 1, 'name': 1, 'locationID': 1})
        return documents

        # get device status infromation
    def get_device_status(self, tenant):
        db = db_connection.connect_mongo(tenant)
        documents = db.devices.find(
            {'isActive': {'$eq': True}}, {'name': 1, 'location_id': 1, 'nextMaintenance': 1, 'channelID': 1})
        return documents


if __name__ == "__main__":
    dx = Device()
