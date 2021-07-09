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
                "$unwind": "$values"
            },
            {
                "$replaceRoot": {"newRoot": "$values"}
            },
            {
                "$project": {
                    "pm2_5": 1,
                    "pm10": 1,
                    "no2": 1,
                    "site_id": {"$toString": "$site_id"}
                }
            },
            {
                "$group": {
                    "_id": "$site_id",
                    "reading": {"$push": {
                        "pm2_5": "$pm2_5.value",
                        "pm10": "$pm10.value",
                        "no2": "$no2.value",
                    }}
                }
            }
        ])


class Exceedance:
    def __init__(self, tenant):
        self.tenant = tenant

    def save_exceedance(self, records):
        tenant = self.tenant
        db = connect_mongo(tenant)
        return db.exceedances.insert(records)
