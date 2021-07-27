from config.db_connection import connect_mongo
from pymongo import DESCENDING, ASCENDING

# DEVICE_STATUS_PROJECT = {
#     '_id': {'$toString': '$_id'},
#     'count_due_maintenance': 1,
#     'count_of_alternator_devices': 1,
#     'count_of_mains': 1,
#     'count_of_offline_devices': 1,
#     'count_of_online_devices': 1,
#     'count_of_solar_devices': 1,
#     'count_overdue_maintenance': 1,
#     'count_unspecified_maintenance': 1,
#     'created_at': 1,
#     'offline_devices': {
#         '_id': {'$toString': '$_id'},
#         'device_number': 1,
#         'elapsed_time': 1,
#         'isActive': 1,
#         'isRetired': 1,
#         'latitude': 1,
#         'longitude': 1,
#         'maintenance_status': 1,
#         'mobility': 1,
#         'name': 1,
#         'nextMaintenance': 1,
#         'powerType': 1,
#         'site_id': {'$toString': '$site_id'},
#     }
# }


class DeviceStatus:
    def __init__(self, tenant):
        self.tenant = tenant
        self.db = self._connect()
        self.collection = self.db['device_status']

    def _connect(self):
        return connect_mongo(self.tenant)

    def get_device_status(self, start_date, end_date, limit):

        db_filter = {'created_at': {'$gte': start_date, '$lt': end_date}}

        if limit:
            return list(self.collection.find(db_filter).sort('created_at', DESCENDING).limit(1))

        return list(self.collection.find(db_filter).sort('created_at', DESCENDING))


class NetworkUptime:
    def __init__(self, tenant):
        self.tenant = tenant
        self.db = self._connect()
        self.collection = self.db['network_uptime']

    def _connect(self):
        return connect_mongo(self.tenant)

    def get_network_uptime(self, start_date, end_date):

        db_filter = {'created_at': {'$gte': start_date, '$lt': end_date}}

        return list(self.collection.find(db_filter).sort('created_at', ASCENDING))
