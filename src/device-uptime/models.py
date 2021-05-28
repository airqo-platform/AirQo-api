from config import connect_mongo


class Device:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_active_devices(self):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.devices.find(
            {
                '$and': [{
                    "channelID": {'$ne': ''},
                    'isActive': {'$eq': True}
                }]
            }
        )


class DeviceUptime:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_device_uptime(self, device_name, days):
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = list(db.device_uptime.find(
            {'device_name': device_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_device_uptime(self, records):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.device_uptime.insert_many(records)


class NetworkUptime():
    def __init__(self, tenant):
        self.tenant = tenant

    def get_network_uptime(self, network_name, days):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.network_uptime.find(
            {'network_name': network_name}, {'_id': 0}
        ).sort([('$natural', -1)]).limit(days)

    def save_network_uptime(self, records):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.network_uptime.insert_many(records)
