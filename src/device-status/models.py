from config import connect_mongo


class Device:
    def __init__(self, tenant):
        self.tenant = tenant.lower()
        self.db = self._connect()

    def _connect(self):
        return connect_mongo(self.tenant, 'device_registry')

    def get_devices(self):
        return self.db.devices.find(
            {},
            {
                '_id': 1,
                'name': 1,
                'site_id': 1,
                'nextMaintenance': 1,
                'device_number': 1,
                'isActive': 1,
                'isRetired': 1,
                'longitude': 1,
                'latitude': 1,
                'mobility': 1,
                'powerType': 1,
                'power': 1,
            }
        )

    def get_device_power(self):
        return self.db.devices.find(
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

    def get_device_status(self):
        return self.db.devices.find(
            {'isActive': {'$eq': True}},
            {'name': 1, 'location_id': 1, 'nextMaintenance': 1, 'channelID': 1}
        )


class DeviceStatus:
    def __init__(self, tenant):
        self.tenant = tenant.lower()
        self.db = self._connect()

    def _connect(self):
        return connect_mongo(self.tenant, 'device_monitoring')

    def get_device_status(self, device_name, days):
        return list(self.db.device_status.find(
            {'device_name': device_name},
            {'_id': 0}
        ).sort([('$natural', -1)]).limit(days))

    def save_device_status(self, records):
        return self.db.device_status.insert_many(records)
