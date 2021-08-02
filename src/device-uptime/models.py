from config import connect_mongo


class Device:
    def __init__(self, tenant):
        self.tenant = tenant
        self.db = self._connect()

    def _connect(self):
        return connect_mongo(self.tenant, 'device_registry')

    def get_all_devices(self):
        return list(self.db.devices.find())


class DeviceUptime:
    def __init__(self, tenant):
        self.tenant = tenant.lower()
        self.db = self._connect()

    def _connect(self):
        return connect_mongo(self.tenant, 'device_monitoring')

    def get_device_uptime(self, device_name, days):

        return list(
            self.db.device_uptime
                .find(
                    {'device_name': device_name},
                    {'_id': 0}
                )
                .sort([('$natural', -1)])
                .limit(days)
        )

    def save_device_uptime(self, records):
        return self.db.device_uptime.insert_many(records)


class NetworkUptime:
    def __init__(self, tenant):
        self.tenant = tenant
        self.db = self._connect()

    def _connect(self):
        return connect_mongo(self.tenant, 'device_monitoring')

    def get_network_uptime(self, network_name, days):
        return (
            self.db.network_uptime
                .find(
                    {'network_name': network_name},
                    {'_id': 0}
                )
                .sort([('$natural', -1)])
                .limit(days)
        )

    def save_network_uptime(self, records):
        return self.db.network_uptime.insert_many(records)
