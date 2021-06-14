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
        return pd.dataframe(transformed_sites)

    def get_boundary_layer_data(self):
        boundaries = {boundary['hour']: boundary['height'] for boundary in BoundaryLayer().get_boundary_layer()}
        return pd.Series(boundaries)

    def get_meta_data(self):
        return self._transform_sites(Site().get_sites())

    def get_forecast_data(self):
        pass

    def get_data(self):
        pass
