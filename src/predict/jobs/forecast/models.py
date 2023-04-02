import requests
from config import connect_mongo_device_registry, configuration
from utils import previous_months_range, date_to_str, str_to_date
from datetime import timedelta


class BaseModel:
    def __init__(self):
        self.db = connect_mongo_device_registry()


class Events(BaseModel):
    def __init__(self):
        super().__init__()

    def get_events_db(self):
        # TODO add two/three months data filtering
        start_date, _ = previous_months_range(int(configuration.MONTHS_OF_DATA))
        created_at = str_to_date(date_to_str(
            start_date.replace(microsecond=0, second=0, minute=0) - timedelta(days=4)))
        print("created at", created_at)
        time_format = '%Y-%m-%dT%H:%M:%S%z'
        query = {'$match': {'first': {'$gte': created_at}}}
        projection = {'$project': {
            '_id': 0,
            'first': {
                '$dateToString': {
                    'format': time_format, 'date': '$first', 'timezone': 'Africa/Kampala'
                }},
            'values': {
                'pm2_5': 1,
                'device_number': 1,
                'time': 1
            }
        }}

        return list(self.db.events.aggregate([query, projection]))

    def get_events(self):
        try:
            api_url = f'{configuration.AIRQO_API_BASE_URL}device/events?tenant={configuration.TENANT}&active=yes&startTime=2021-11-19'
            results = requests.get(api_url, verify=False)
            events_data = results.json()["measurements"]
        except Exception as ex:
            print("Events Url returned an error : " + str(ex))
            events_data = {}

        return events_data
