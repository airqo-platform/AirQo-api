from config.db_connection import connect_mongo
from pymongo import DESCENDING, ASCENDING


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


class DeviceUptime:
    def __init__(self, tenant):
        self.tenant = tenant
        self.db = self._connect()
        self.collection = self.db['device_uptime']

    def _connect(self):
        return connect_mongo(self.tenant)

    def get_device_uptime(self, start_date, end_date, device_name):

        db_filter = {'created_at': {'$gte': start_date, '$lt': end_date}}

        if device_name:
            db_filter['device_name'] = device_name

        return list(
            self.collection.aggregate(
                [
                    {"$match": db_filter},
                    {
                        "$group": {
                            "_id": '$device_name',
                            # "uptime": {'$push': "$$ROOT"}
                            "values": {'$push': {
                                '_id': {'$toString': '$_id'},
                                "battery_voltage": "$battery_voltage",
                                "channel_id": "$channel_id",
                                "created_at": { '$dateToString': {
                                    'date':"$created_at",
                                    'format': '%Y-%m-%dT%H:%M:%S%z',
                                    'timezone': 'Africa/Kampala',
                                }},
                                "device_name": "$device_name",
                                "downtime": "$downtime",
                                "sensor_one_pm2_5": "$sensor_one_pm2_5",
                                "sensor_two_pm2_5": "$sensor_two_pm2_5",
                                "uptime": "$uptime"
                            }}
                        }
                    }
                ]
            )
        )
