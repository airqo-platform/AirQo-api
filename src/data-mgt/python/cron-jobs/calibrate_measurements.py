from datetime import datetime, timedelta

from airqo_api import AirQoApi


def get_measurements():
    time = datetime.utcnow()
    start_time = (time - timedelta(hours=1)).strftime('%Y-%m-%dT%H:00:00Z')
    end_time = (datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') + timedelta(hours=1)).strftime('%Y-%m-%dT%H:00:00Z')

    airqo_api = AirQoApi()

    events = airqo_api.get_events(tenant='airqo', start_time=start_time, end_time=end_time)

    print(events)




