from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from .abstract_data_source import AbstractDataSource
from models import BoundaryLayer, Site, Events
from config import PREDICTION_FEATURES, SITE_FEATURE_MAPPER


class MongoDataSource(AbstractDataSource):

    @staticmethod
    def _transform_sites(sites):
        feature_mappers = list(zip(PREDICTION_FEATURES, SITE_FEATURE_MAPPER))
        transformed_sites = []
        for site in sites:
            transformed_site = {}
            for actual_key, data_key in feature_mappers:
                transformed_site[actual_key] = site.get(data_key)
            transformed_sites.append(transformed_site)
        return pd.DataFrame(transformed_sites)

    @staticmethod
    def _transform_events( events):
        transformed_events = []
        for event in events:
            for value in event.get('values', []):
                transformed_event = {
                    'pm2_5': value.get('pm2_5') and value.get('pm2_5').get('value'),
                    'channel_id': value.get('channelID'),
                    'created_at': value.get('time'),
                }

                if transformed_event['created_at']:
                    transformed_event['created_at'] = transformed_event['created_at'].isoformat()

                transformed_events.append(transformed_event)

        return pd.DataFrame(transformed_events)

    def get_boundary_layer_data(self):
        boundaries = {boundary['hour']: boundary['height'] for boundary in BoundaryLayer().get_boundary_layer()}
        return pd.Series(boundaries)

    def get_meta_data(self):
        return self._transform_sites(Site().get_sites())

    def get_forecast_data(self):
        return self._transform_events(Events().get_events())

    def get_data(self):
        with ThreadPoolExecutor() as executor:
            forecast = executor.submit(self.get_forecast_data())
            boundary_layer = executor.submit(self.get_boundary_layer_data())
            meta = executor.submit(self.get_meta_data())

            try:
                boundary_layer_data = boundary_layer.result()
                meta_data = meta.result()
                forecast_data = forecast.result()
                return forecast_data, meta_data, boundary_layer_data

            except Exception as exc:
                print("Could not retrieve data")
                print("Reason -", exc)
                return [], [], []

