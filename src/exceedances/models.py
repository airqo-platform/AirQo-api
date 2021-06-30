from config import connect_mongo


class Event:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_events(self, start_date, end_date):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.events.aggregate([
            {
                "$match": {
                    "values.time": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }
            },
            {
                "$unwind": "values"
            },
            {
                "$replaceRoot": {"newRoot": "$values"}
            },
            {
                "$project": {
                    "pm2_5": 1,
                    "pm10": 1,
                    "no2": 1,
                    "site_id": 1
                }
            }
        ])


class Exceedance:
    def save_exceedance(self, records):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.exceedances(records)


class Site:
    def __init__(self, tenant):
        self.tenant = tenant

    def get_sites(self, id):
        tenant = self.tenant
        db = connect_mongo(tenant)
        results = list(db.sites.find(
            {'_id': id}, {'_id': 0}.sort([('$natural', -1)])))
        return results.sites
