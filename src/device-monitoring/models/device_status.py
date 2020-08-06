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
            {'isActive': {'$eq': True}}, {'name': 1, 'location_id': 1, 'nextMaintenance': 1, 'channelID': 1})
        return documents

    # get device maintenance log infromation
    def get_device_maintenance_log(self):
        db = db_helpers.connect_mongo()
        documents = db.maintenance_log.find({})
        return documents

     # get maintenance log for a given device name/id
    def get_device_name_maintenance_log(self, device_name):
        db = db_helpers.connect_mongo()
        documents = db.maintenance_log.find({'device': device_name})
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
                  round(result['average_uptime_for_entire_network_for_twelve_months']
                        ['average_uptime_for_entire_network_in_percentage'], 2),
                  round(result['average_uptime_for_entire_network_for_all_time']['average_uptime_for_entire_network_in_percentage'], 2)]

        labels = ['24 hours', '7 days', '28 days', '12 months', 'all time']

        '''
         obj = {"twentyfour_hours_uptime": result['average_uptime_for_entire_network_for_twentyfour_hours']['average_uptime_for_entire_network_in_percentage'],
                    'seven_days_uptime': result['average_uptime_for_entire_network_for_seven_days']['average_uptime_for_entire_network_in_percentage'],
                    'twenty_eight_days_uptime': result['average_uptime_for_entire_network_for_twenty_eight_days']['average_uptime_for_entire_network_in_percentage'],
                    'twelve_months_uptime': result['average_uptime_for_entire_network_for_twelve_months']['average_uptime_for_entire_network_in_percentage'],
                    "created_at":created_at}
                    }
        '''

        uptime_result = {'uptime_values': values, 'uptime_labels': labels,
                         'created_at': utils.convert_GMT_time_to_EAT_local_time(result['created_at'])}
        return uptime_result

    def get_device_rankings(self, sorting_order):
        "gets the latest device rankings i.e best and worst performing devices interms of network uptime and downtime for the specified time period"
        db = db_helpers.connect_mongo()
        results = list(db.network_uptime_analysis_results.find(
            {}, {'_id': 0}).sort([('$natural', -1)]).limit(1))

        sort_order = True

        result = results[0]
        if sorting_order == 'asc':
            sort_order = False

        best_performing_devices_for_twentyfour_hours = sorted(
            result['average_uptime_for_entire_network_for_twentyfour_hours']['device_uptime_records'], key=lambda i: i['device_uptime_in_percentage'], reverse=sort_order)
        best_performing_devices_for_seven_days = sorted(
            result['average_uptime_for_entire_network_for_seven_days']['device_uptime_records'], key=lambda i: i['device_uptime_in_percentage'], reverse=sort_order)
        best_performing_devices_for_twenty_eight_days = sorted(
            result['average_uptime_for_entire_network_for_twenty_eight_days']['device_uptime_records'], key=lambda i: i['device_uptime_in_percentage'], reverse=sort_order)
        best_performing_devices_for_twelve_months = sorted(
            result['average_uptime_for_entire_network_for_twelve_months']['device_uptime_records'], key=lambda i: i['device_uptime_in_percentage'], reverse=sort_order)
        best_performing_devices_for_all_time = sorted(
            result['average_uptime_for_entire_network_for_all_time']['device_uptime_records'], key=lambda i: i['device_uptime_in_percentage'], reverse=sort_order)

        ranking_results = {'24 hours': best_performing_devices_for_twentyfour_hours,
                           '7 days': best_performing_devices_for_seven_days,
                           '28 days': best_performing_devices_for_twenty_eight_days,
                           '12 months': best_performing_devices_for_twelve_months,
                           'all time': best_performing_devices_for_all_time}

        return ranking_results

    def get_device_uptime_analysis_results(self, device_channel_id):
        "gets the latest device uptime for the device with the specifided channel id"
        db = db_helpers.connect_mongo()
        results = list(db.network_uptime_analysis_results.find(
            {}, {'_id': 0}).sort([('$natural', -1)]).limit(1))

        result = results[0]

        labels = ['24 hours', '7 days', '28 days', '12 months', 'all time']

        twenty_four_hour_devices = result['average_uptime_for_entire_network_for_twentyfour_hours']['device_uptime_records']
        device_twenty_four_hour_uptime = [d['device_uptime_in_percentage']
                                          for d in twenty_four_hour_devices if d['device_channel_id'] == device_channel_id]

        seven_days_devices = result['average_uptime_for_entire_network_for_seven_days']['device_uptime_records']
        device_seven_days_uptime = [d['device_uptime_in_percentage']
                                    for d in seven_days_devices if d['device_channel_id'] == device_channel_id]

        twenty_eight_days_devices = result['average_uptime_for_entire_network_for_twenty_eight_days']['device_uptime_records']
        device_twenty_eight_days_uptime = [d['device_uptime_in_percentage']
                                           for d in twenty_eight_days_devices if d['device_channel_id'] == device_channel_id]

        twelve_months_devices = result['average_uptime_for_entire_network_for_twelve_months']['device_uptime_records']
        device_twelve_months_uptime = [d['device_uptime_in_percentage']
                                       for d in twelve_months_devices if d['device_channel_id'] == device_channel_id]

        all_time_devices = result['average_uptime_for_entire_network_for_all_time']['device_uptime_records']
        device_all_time_uptime = [d['device_uptime_in_percentage']
                                  for d in all_time_devices if d['device_channel_id'] == device_channel_id]

        if device_twenty_four_hour_uptime and device_seven_days_uptime and twenty_eight_days_devices and twelve_months_devices and device_all_time_uptime:
            values = [round(device_twenty_four_hour_uptime[0], 2), round(device_seven_days_uptime[0], 2),
                      round(device_twenty_eight_days_uptime[0], 2), round(device_twelve_months_uptime[0], 2), round(device_all_time_uptime[0], 2)]
            uptime_result = {'uptime_values': values, 'uptime_labels': labels,
                             'created_at': utils.convert_GMT_time_to_EAT_local_time(result['created_at'])}
        else:
            values = []
            uptime_result = {
                "message": "Uptime data not available for the specified device", "success": False}
        return uptime_result


if __name__ == "__main__":
    dx = DeviceStatus()
