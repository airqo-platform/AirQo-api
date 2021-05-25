from config.db_connection import connect_mongo


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
