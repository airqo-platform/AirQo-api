from config import db_connection


class DeviceStatus():
    """
    """

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_device_status(self, device_name, days):
        """
        """
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = list(db.device_status.find(
            {'device_name': device_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_device_status(self, records):
        """
        """
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        results = db.device_status.insert_many(records)
        return results
