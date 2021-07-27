from config.db_connection import connect_mongo
from pymongo import DESCENDING, ASCENDING

from app import cache


class BaseModel:
    __abstract__ = True

    def __init__(self, tenant, collection_name):
        self.tenant = tenant.lower()
        self.collection_name = collection_name
        self.db = self._connect()
        self.collection = self.db[collection_name]

    def _connect(self):
        return connect_mongo(self.tenant)

    def __repr__(self):
        return f"{self.__class__.__name__}({self.tenant}, {self.collection_name})"


class DeviceStatus(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, 'device_status')

    @cache.memoize()
    def get_device_status(self, start_date, end_date, limit):

        db_filter = {'created_at': {'$gte': start_date, '$lt': end_date}}

        if limit:
            return list(self.collection.find(db_filter).sort('created_at', DESCENDING).limit(1))

        return list(self.collection.find(db_filter).sort('created_at', DESCENDING))


class NetworkUptime(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, 'network_uptime')

    @cache.memoize()
    def get_network_uptime(self, start_date, end_date):

        db_filter = {'created_at': {'$gte': start_date, '$lt': end_date}}

        return list(self.collection.find(db_filter).sort('created_at', ASCENDING))


class DeviceUptime(BaseModel):
    def __init__(self, tenant):
        super().__init__(tenant, 'device_uptime')

    @cache.memoize()
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
