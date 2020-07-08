import app
from datetime import datetime, timedelta
from helpers import db_helpers, utils
import requests
import math
from google.cloud import bigquery
import pandas as pd


class DeviceStatus():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self):
        """ initialize """

    # get device status infromation
    def get_device_status(self):
        db = db_helpers.connect_mongo()
        documents = db.devices.find(
            {'$and': [{'locationID': {'$ne': ""}}, {'status': {'$ne': "Retired"}}]})
        return documents

    # get device maintenance log infromation
    def get_device_maintenance_log(self):
        db = db_helpers.connect_mongo()
        documents = db.maintenance_log.find({})
        return documents

    # get devices status infromation
    def get_device_power(self):
        db = db_helpers.connect_mongo()
        documents = db.devices.find({'$and': [{'locationID': {'$ne': ""}}, {'status': {'$ne': "Retired"}}, {'power': {'$ne': ""}}]}, {
                                    'power': 1, 'name': 1, 'locationID': 1})
        return documents

    def get_all_devices_latest_status(self):
        """
        Gets the latest status of whether device was online or offline in the last two hours.

        Args:
        Returns:
            A list of the records containing the status of devices interms of percentage,
            the count of devices that were offline and online and the devices info.
        """
        created_at = utils.str_to_date(utils.date_to_str(
            datetime.now().replace(microsecond=0, second=0, minute=0)-timedelta(hours=4)))
        # print(created_at)
        time_format = '%Y-%m-%dT%H:%M:%S%z'
        query = {'$match': {'created_at': {'$gte': created_at}}}
        projection = {'$project': {'_id': 0, 'created_at': {'$dateToString': {
            'format': time_format, 'date': '$time', 'timezone': 'Africa/Kampala'}}, }}
        sort_order = {'$sort': {'_id': -1}}
        limit = {'$limit': 1}
        db = db_helpers.connect_mongo()
        # results = db.device_status_hourly_check_results.find().sort([('_id',-1)]).limit(1)
        results = db.device_status_hourly_check_results.find(
            {}, {'_id': 0}).sort([('$natural', -1)]).limit(1)
        # results = list(db.device_status_hourly_check_results.aggregate([query, projection,sort_order,limit]) )
        return results

    def get_all_devices(self):
        db = db_helpers.connect_mongo()
        results = list(db.device_status_summary.find({}, {'_id': 0}))
        return results

    def str_to_date_find(self, st):
        """
        Converts a string of different format to datetime
        """
        return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')

    def get_network_uptime_analysis_results(self):
        "gets the latest network uptime for the specified hours"
        db = db_helpers.connect_mongo()
        results = list(db.network_uptime_analysis_results.find(
            {}, {'_id': 0}).sort([('$natural', -1)]).limit(1))

        result = results[0]

        values = [round(result['average_uptime_for_entire_network_for_twentyfour_hours']['average_uptime_for_entire_network_in_percentage'], 2),
                  round(result['average_uptime_for_entire_network_for_seven_days']
                        ['average_uptime_for_entire_network_in_percentage'], 2),
                  round(result['average_uptime_for_entire_network_for_twenty_eight_days']
                        ['average_uptime_for_entire_network_in_percentage'], 2),
                  round(result['average_uptime_for_entire_network_for_twelve_months']['average_uptime_for_entire_network_in_percentage'], 2)]

        labels = ['24 hours', '7 days', '28 days', '12 months']

        '''
         obj = {"twentyfour_hours_uptime": result['average_uptime_for_entire_network_for_twentyfour_hours']['average_uptime_for_entire_network_in_percentage'],
                    'seven_days_uptime': result['average_uptime_for_entire_network_for_seven_days']['average_uptime_for_entire_network_in_percentage'],
                    'twenty_eight_days_uptime': result['average_uptime_for_entire_network_for_twenty_eight_days']['average_uptime_for_entire_network_in_percentage'],
                    'twelve_months_uptime': result['average_uptime_for_entire_network_for_twelve_months']['average_uptime_for_entire_network_in_percentage'],
                    "created_at":created_at}
                    }
        '''

        uptime_result = {'uptime_values': values,
                         'uptime_labels': labels, 'created_at': result['created_at']}
        return uptime_result


if __name__ == "__main__":
    dx = DeviceStatus()
