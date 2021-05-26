from config import db_connection


class Device:
    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant

    def get_active_devices(self):
        tenant = self.tenant
        db = db_connection.connect_mongo(tenant)
        # results = list(db.devices.find({"channelID": {'$ne': ''}}))
        return db.devices.find(
            {
                '$and': [{
                    "channelID": {'$ne': ''},
                    'isActive': {'$eq': True}
                }]
            }
        )

