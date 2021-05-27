from config import connect_mongo


class Device:
    def __init__(self, tenant):
        """ initialize """
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

