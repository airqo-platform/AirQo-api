from config import connect_mongo


class NetworkUptime():

    def __init__(self, tenant):
        self.tenant = tenant

    def get_network_uptime(self, network_name, days):
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = list(db.network_uptime.find(
            {'network_name': network_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_network_uptime(self, records):
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = db.network_uptime.insert_many(records)
        return results
