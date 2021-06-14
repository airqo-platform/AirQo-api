import pandas as pd
from .abstract_data_source import AbstractDataSource
from .utils import get_csv_file_from_gcs
import config


class CSVDataSource(AbstractDataSource):

    def get_boundary_layer_data(self):
        boundary_layer = get_csv_file_from_gcs(
            'airqo-250220', 'airqo_prediction_bucket', config.CSV_BOUNDARY_LAYER_PATH
        )
        return pd.Series(index=boundary_layer['hour'], data=boundary_layer['height'])

    def get_meta_data(self):
        metadata = get_csv_file_from_gcs('airqo-250220', 'airqo_prediction_bucket', config.CSV_METADATA_PATH)
        fts = [c for c in metadata if c not in ['chan_id']]
        cat_fts = metadata[fts].select_dtypes('object').columns.tolist()
        metadata[cat_fts] = metadata[cat_fts].apply(lambda x: pd.factorize(x)[0])
        metadata = metadata.rename({'chan_id': 'channel_id'}, axis=1)
        drop_fts = [
            'loc_ref', 'chan_ref', 'loc_mob_stat', 'airqo_name', 'district_lookup', 'county_lookup', 'coords',
            'loc_start_date', 'loc_end_date', 'gmaps_link', 'OSM_link', 'nearby_sources', 'geometry',
            'geometry_43', 'event_logging_link'
        ]

        metadata = metadata.drop(drop_fts, axis=1)

        return metadata

    def get_forecast_data(self, metadata):
        forecast_data = pd.read_csv(config.CSV_FORECAST_DATA_PATH, usecols=['created_at', 'channel_id', 'pm2_5'])
        forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'], format='%Y-%m-%d %H:%M:%S')
        forecast_data['date'] = forecast_data['created_at'].dt.date
        forecast_data = forecast_data[forecast_data['channel_id'].isin(metadata['channel_id'])].reset_index(drop=True)
        channel_max_dates = forecast_data.groupby('channel_id').apply(lambda x: x['created_at'].max())

        ### Set this as a list of chanels to be used. Can be read from a file.
        use_channels = channel_max_dates[channel_max_dates > pd.to_datetime('2020-07-12')].index.tolist()
        # use_channels =  get_all_static_channels()

        return forecast_data[forecast_data['channel_id'].isin(use_channels)]

    def get_data(self):
        boundary_layer_data = self.get_boundary_layer_data()
        meta_data = self.get_meta_data()
        forecast_data = self.get_forecast_data(meta_data)

        return forecast_data, meta_data, boundary_layer_data
