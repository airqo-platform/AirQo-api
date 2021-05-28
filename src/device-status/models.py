from config import connect_mongo


class Device:

    def get_devices(self, tenant):
        db = connect_mongo(tenant)
        documents = db.devices.find(
            {})
        return documents

    def get_device_power(self, tenant):
        db = connect_mongo(tenant)
        return db.devices.find(
            {
                '$and': [
                    {'locationID': {'$ne': ""}},
                    {'status': {'$ne': "Retired"}},
                    {'power': {'$ne': ""}}
                ]
            },
            {
                'power': 1, 'name': 1, 'locationID': 1
            }
        )

    def get_device_status(self, tenant):
        db = connect_mongo(tenant)
        return db.devices.find(
            {'isActive': {'$eq': True}},
            {'name': 1, 'location_id': 1, 'nextMaintenance': 1, 'channelID': 1}
        )


class DeviceStatus():

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_device_status(self, device_name, days):
        """
        """
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = list(db.device_status.find(
            {'device_name': device_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_device_status(self, records):
        """
        """
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = db.device_status.insert_many(records)
        return results

