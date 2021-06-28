from config import connect_mongo


class Events:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_active_devices(self):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.devices.find(
            {
                '$and': [{
                    "device_number": {'$ne': ''},
                    'isActive': {'$eq': True}
                }]
            }
        )


class Exceedances:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_exceedance(self, site_name, days):
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = list(db.exceedanaces.find(
            {'site_name': site_name}, {'_id': 0}).sort([('$natural', -1)]).limit(days))
        return results

    def save_exceedance(self, records):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.exceedances(records)


class Sites:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_sites(self, id):
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = list(db.exceedances.find(
            {'_id': id}, {'_id': 0}.sort([('$natural', -1)])))
        return results
