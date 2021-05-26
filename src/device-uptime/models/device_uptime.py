from config import db_connection


class DeviceUptime():

    def __init__(self, tenant):
        self.tenant = tenant

    def get_device_uptime(self, device_name, days):
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = list(db.device_uptime.find(
            {'device_name': device_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_device_uptime(self, records):
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = db.device_uptime.insert_many(records)
        return results
