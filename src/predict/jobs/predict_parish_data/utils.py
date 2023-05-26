from datetime import datetime

import geopandas as gpd
import pandas as pd
import requests
import xgboost as xgb
from google.cloud import bigquery
from pymongo import MongoClient

from configure import Config


def get_airqlouds() -> list:
    airqloud_url = 'https://platform.airqo.net/api/v2/devices/airqlouds/summary'
    airqloud_params = {'tenant': 'airqo', 'token': ""}
    airqloud_response = requests.get(airqloud_url, params=airqloud_params)
    airqlouds = airqloud_response.json()['airqlouds']
    airqlouds = list(map(lambda airqloud: {**airqloud, "id": airqloud["_id"]}, airqlouds))
    return list(filter(lambda airqloud: str(airqloud["admin_level"]).lower() == "country", airqlouds))


def get_data_from_bigquery(
    airqlouds: list,
    start_date: datetime,
    end_date: datetime,
) -> pd.DataFrame:
    airqlouds_sites_table = f"`{Config.BIGQUERY_AIRQLOUDS_SITES}`"
    hourly_data_table = f"`{Config.BIGQUERY_HOURLY_DATA}`"
    sites_table = f"`{Config.BIGQUERY_SITES}`"

    # Get airqloud sites
    meta_data_query = (
        f" SELECT  {airqlouds_sites_table}.site_id as site_id, "
        f" SELECT  {airqlouds_sites_table}.airqloud_id as airqloud_id"
        f" FROM {airqlouds_sites_table} "
        f" WHERE {airqlouds_sites_table}.airqloud_id IN UNNEST({airqlouds}) "
    )

    # Add site information
    meta_data_query = (
        f" SELECT {sites_table}.latitude as site_latitude, "
        f" {sites_table}.longitude as site_longitude , "
        f" meta_data.* "
        f" FROM {sites_table} "
        f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {sites_table}.id "
    )

    # Merge queries
    query = (
        f" SELECT ROUND(pm2_5, 2) AS pm2_5 , FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {hourly_data_table}.timestamp) AS time, "
        f" meta_data.* "
        f" FROM {hourly_data_table} "
        f" RIGHT JOIN ({meta_data_query}) meta_data ON meta_data.site_id = {hourly_data_table}.site_id "
        f" WHERE {hourly_data_table}.timestamp >= '{start_date}' "
        f" AND {hourly_data_table}.timestamp <= '{end_date}' "
    )

    job_config = bigquery.QueryJobConfig()
    job_config.use_query_cache = True

    dataframe = (
        bigquery.Client()
        .query(
            f"select distinct * from ({query})",
            job_config,
        )
        .result()
        .to_dataframe()
    )

    dataframe.dropna(inplace=True)
    return dataframe


def get_shapefiles_gdf() -> gpd.GeoDataFrame:
    client = MongoClient(Config.MONGO_URI)
    db = client[Config.MONGO_DB]
    collection = db[Config.MONGO_COLLECTION]
    uganda_data = collection.find()
    features = [document for document in uganda_data]
    return gpd.GeoDataFrame.from_features(features)


def predict_air_quality(data: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    df = pd.DataFrame(data[['parish', 'pm2_5', "km2", "population_density", 'geometry']])

    train_data = df[df['pm2_5'].notna()]
    test_data = df[df['pm2_5'].isna()]

    x_train = train_data[['km2', 'population_density']]
    y_train = train_data['pm2_5']
    x_test = test_data[['km2', 'population_density']]

    # Train the model
    model = xgb.XGBRegressor()
    model.fit(x_train, y_train)
    predicted_values = model.predict(x_test)

    # Update the DataFrame with predicted values
    df.loc[df['pm2_5'].isna(), 'pm2_5'] = predicted_values
    return gpd.GeoDataFrame(df, geometry='geometry')
