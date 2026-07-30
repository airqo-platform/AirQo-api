import base64
from io import BytesIO
import logging
from pathlib import Path
import sys
from unittest.mock import patch

import geopandas as gpd
import joblib
import numpy as np
from PIL import Image
from shapely.geometry import Point, Polygon
from sklearn.ensemble import RandomForestRegressor


SPATIAL_ROOT = Path(__file__).resolve().parents[1]
if str(SPATIAL_ROOT) not in sys.path:
    sys.path.insert(0, str(SPATIAL_ROOT))

from models.heatmapModel import AirQualityPredictor
from views.heatmapViews import AQIImageGenerator


def _predictor(model_dir, bucket=None):
    predictor = AirQualityPredictor.__new__(AirQualityPredictor)
    predictor.MODEL_DIR = str(model_dir)
    predictor.SPATIAL_PROJECT_BUCKET = bucket
    predictor.models = {}
    predictor.logger = logging.getLogger('test-heatmap')
    return predictor


def _trained_model():
    model = RandomForestRegressor(n_estimators=2, random_state=42)
    model.fit([[0.0, 0.0], [1.0, 1.0]], [10.0, 30.0])
    return model


def test_model_download_is_persisted_and_reused(tmp_path):
    model = _trained_model()
    downloads = []

    def fake_download(bucket, source, destination):
        downloads.append((bucket, source))
        joblib.dump(model, destination)

    with patch('models.heatmapModel.download_file_from_gcs', fake_download):
        first = _predictor(tmp_path, bucket='heatmap-models')
        assert first._load_model('grid-123', 'Kampala') is not None

        second = _predictor(tmp_path, bucket='heatmap-models')
        assert second._load_model('grid-123', 'Kampala') is not None

    assert downloads == [('heatmap-models', 'grid-123_rf_model.joblib')]
    assert (tmp_path / 'grid-123_rf_model.joblib').is_file()


def test_existing_grid_model_predicts_without_current_sensor_data(tmp_path):
    model = _trained_model()
    joblib.dump(model, tmp_path / 'grid-123_rf_model.joblib')
    polygon = Polygon([(0, 0), (1, 0), (0, 1)])

    predictor = _predictor(tmp_path)
    predictor.gdf = gpd.GeoDataFrame(
        columns=['site_name', 'latitude', 'longitude', 'pm25', 'geometry'],
        geometry='geometry',
        crs='EPSG:4326',
    )
    predictor.gdf_polygons = gpd.GeoDataFrame(
        [{'id': 'grid-123', 'name': 'Kampala', 'geometry': polygon}],
        geometry='geometry',
        crs='EPSG:4326',
    )
    predictor.results = []
    predictor.predictions = []

    assert predictor.train_and_predict(grid_resolution=5)
    predictions = predictor.predictions[0]
    grid_predictions = predictions[predictions['source'] == 'grid_prediction']
    assert not grid_predictions.empty
    assert all(
        polygon.covers(Point(row.longitude, row.latitude))
        for row in grid_predictions.itertuples()
    )


def test_missing_grid_model_is_created_and_saved(tmp_path):
    polygon = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    records = [
        {'site_name': f'site-{index}', 'latitude': value, 'longitude': value, 'pm25': 10 + index}
        for index, value in enumerate([0.1, 0.2, 0.3, 0.4, 0.5])
    ]

    predictor = _predictor(tmp_path)
    predictor.gdf = gpd.GeoDataFrame(
        records,
        geometry=[Point(row['longitude'], row['latitude']) for row in records],
        crs='EPSG:4326',
    )
    predictor.gdf_polygons = gpd.GeoDataFrame(
        [{'id': 'new-grid', 'name': 'New City', 'geometry': polygon}],
        geometry='geometry',
        crs='EPSG:4326',
    )
    predictor.results = []
    predictor.predictions = []

    assert predictor.train_and_predict(grid_resolution=5)
    assert (tmp_path / 'new-grid_rf_model.joblib').is_file()
    assert 'new-grid' in predictor.models


def test_heatmap_pixels_outside_boundary_are_transparent():
    boundary = Polygon([(0, 0), (1, 0), (0, 1)])
    data = [
        (0.0, 0.0, 10.0),
        (0.0, 1.0, 20.0),
        (1.0, 0.0, 30.0),
        (1.0, 1.0, 40.0),
        (0.5, 0.5, 25.0),
    ]

    data_url, bounds, _ = AQIImageGenerator.generate_image_for_city(
        data, 'Kampala', boundary, resolution=50
    )
    image_bytes = base64.b64decode(data_url.split(',', 1)[1])
    rgba = np.asarray(Image.open(BytesIO(image_bytes)).convert('RGBA'))

    assert bounds == [[0.0, 0.0], [1.0, 1.0]]
    assert rgba[5, 45, 3] == 0
    assert rgba[45, 5, 3] > 0
