import pandas as pd
from concurrent.futures import ThreadPoolExecutor
from models import Events


def _transform_events(events):
    transformed_events = []
    for event in events:
        for value in event.get('values', []):
            transformed_event = {
                'pm2_5': value.get('pm2_5') and value.get('pm2_5').get('value'),
                'device_number': value.get('device_number'),
                'created_at': value.get('time'),
            }

            if transformed_event['created_at']:
                transformed_event['created_at'] = transformed_event['created_at'].isoformat()

            transformed_events.append(transformed_event)

    return pd.DataFrame(transformed_events)


def get_forecast_data():
    return _transform_events(Events().get_events_db())


def get_data():
    with ThreadPoolExecutor() as executor:
        forecast = executor.submit(get_forecast_data())

        try:
            forecast_data = forecast.result()
            return forecast_data

        except Exception as exc:
            print("Could not retrieve data")
            print("Reason -", exc)
            return [], [], []
