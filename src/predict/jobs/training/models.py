from config import connect_mongo
from utils import previous_months_range
from datetime import datetime, timedelta


class BaseModel:
    def __init__(self):
        self.db = connect_mongo()


class BoundaryLayer(BaseModel):
    def __init__(self):
        super().__init__()

    def get_boundary_layer(self):
        return self.db.boundary_layer.find()


class Site(BaseModel):
    def __init__(self):
        super().__init__()

    def get_sites(self):
        return self.db.sites.find()

def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')

def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


class Events(BaseModel):
    def __init__(self):
        super().__init__()

    def get_events(self):
        # TODO add two/three months data filtering
        start_date, _ = previous_months_range(2)
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
                'channelID': 1,
                'time': 1
            }
        }}

        return list(self.db.events.aggregate([query, projection]))
