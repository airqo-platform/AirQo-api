from datetime import datetime, timedelta

import geopandas as gpd
from shapely.geometry import Point

from utils import get_airqlouds, get_data_from_bigquery, get_shapefiles_gdf, predict_air_quality

if __name__ == "__main__":
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=7)

    airqlouds = get_airqlouds()
    air_quality_readings = get_data_from_bigquery(
            airqlouds=airqlouds, start_date=start_date, end_date=end_date
        )

    geometry = [Point(xy) for xy in zip(air_quality_readings['longitude'], air_quality_readings['latitude'])]
    air_quality_readings_gdf = gpd.GeoDataFrame(air_quality_readings, geometry=geometry)

    airqlouds_gdf = get_shapefiles_gdf()
    merged_gdf = gpd.sjoin(air_quality_readings_gdf, airqlouds_gdf, how='left', op='contains', lsuffix='_polygon', rsuffix='_point')

    predicted_gdf = predict_air_quality(merged_gdf)
    print(predicted_gdf)
