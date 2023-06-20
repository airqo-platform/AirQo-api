from datetime import datetime

import geopandas as gpd
import pandas as pd
import requests
import xgboost as xgb
from google.cloud import bigquery
from pymongo import MongoClient
from shapely import Polygon, MultiPolygon
from sqlalchemy import create_engine

from configure import Config


def get_airqlouds() -> list:
    airqloud_url = f"{Config.DEVICE_REGISTRY_URL}/airqlouds/summary"
    airqloud_params = {"tenant": "airqo", "token": Config.AIRQO_API_TOKEN}
    airqloud_response = requests.get(airqloud_url, params=airqloud_params)
    airqlouds = airqloud_response.json()["airqlouds"]
    airqlouds = list(
        map(lambda airqloud: {**airqloud, "id": airqloud["_id"]}, airqlouds)
    )
    return list(
        filter(
            lambda airqloud: str(airqloud["admin_level"]).lower() == "country"
            and str(airqloud["name"]).lower() == "uganda",
            airqlouds,
        )
    )


def get_data_from_bigquery(
    airqloud_ids: list,
    start_date: datetime,
    end_date: datetime,
) -> pd.DataFrame:
    airqlouds_sites_table = f"`{Config.BIGQUERY_AIRQLOUDS_SITES}`"
    hourly_data_table = f"`{Config.BIGQUERY_HOURLY_DATA}`"
    sites_table = f"`{Config.BIGQUERY_SITES}`"

    # Get airqloud sites
    meta_data_query = (
        f" SELECT  {airqlouds_sites_table}.site_id as site_id, "
        f" {airqlouds_sites_table}.airqloud_id as airqloud_id "
        f" FROM {airqlouds_sites_table} "
        f" WHERE {airqlouds_sites_table}.airqloud_id IN UNNEST({airqloud_ids}) "
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
        f" SELECT ROUND(pm2_5_calibrated_value, 2) AS pm2_5 , FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', {hourly_data_table}.timestamp) AS time, "
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

    dataframe.dropna(
        inplace=True, subset=["site_latitude", "site_longitude", "airqloud_id"]
    )
    return dataframe


def get_shapefiles_gdf() -> gpd.GeoDataFrame:
    client = MongoClient(Config.MONGO_URI)
    db = client[Config.MONGO_DB]
    collection = db[Config.MONGO_SHAPE_FILES_COLLECTION]
    shapefiles = collection.find()
    features = [document for document in shapefiles]
    data = gpd.GeoDataFrame.from_features(features)
    data.rename(columns={"km2": "square_kilometres"}, inplace=True)
    return data


def predict_air_quality(data: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    df = pd.DataFrame(
        data[["parish", "pm2_5", "square_kilometres", "population_density", "geometry"]]
    )

    train_data = df[df["pm2_5"].notna()]
    test_data = df[df["pm2_5"].isna()]

    x_train = train_data[["square_kilometres", "population_density"]]
    y_train = train_data["pm2_5"]
    x_test = test_data[["square_kilometres", "population_density"]]

    # Train the model
    model = xgb.XGBRegressor()
    model.fit(x_train, y_train)
    predicted_values = model.predict(x_test)

    # Update the DataFrame with predicted values
    df.loc[df["pm2_5"].isna(), "pm2_5"] = predicted_values
    data = gpd.GeoDataFrame(df, geometry="geometry")
    data["timestamp"] = datetime.utcnow()
    return data


def format_geometry(formatted_data: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    for index, row in formatted_data.iterrows():
        if row.geometry.geom_type == "Polygon":
            corrected_polygon = Polygon(row.geometry.exterior, row.geometry.interiors)
            formatted_data.at[index, "geometry"] = corrected_polygon
        elif row.geometry.geom_type == "MultiPolygon":
            polygons = []
            for polygon in row.geometry.geoms:
                polygons.append(Polygon(polygon.exterior, polygon.interiors))
            corrected_multipolygon = MultiPolygon(polygons)
            formatted_data.at[index, "geometry"] = corrected_multipolygon

    return formatted_data


def save_predicted_air_quality_in_postgresql(data: gpd.GeoDataFrame):
    engine = create_engine(Config.POSTGRES_CONNECTION_URL)

    data.to_postgis(name=Config.POSTGRES_TABLE, con=engine, if_exists="replace")

    print(f"Successfully saved data on PostgresSQL")


def save_predicted_air_quality(data: gpd.GeoDataFrame, table: str):
    data = format_geometry(data)
    data.dropna(inplace=True)
    client = bigquery.Client()
    job_config = bigquery.LoadJobConfig(
        schema=[
            bigquery.SchemaField("square_kilometres", "FLOAT"),
            bigquery.SchemaField("pm2_5", "FLOAT"),
            bigquery.SchemaField("population_density", "FLOAT"),
            bigquery.SchemaField("parish", "STRING"),
            bigquery.SchemaField("timestamp", "DATETIME"),
            bigquery.SchemaField("geometry", "GEOGRAPHY"),
        ],
        create_disposition=bigquery.CreateDisposition.CREATE_IF_NEEDED,
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )

    job = client.load_table_from_dataframe(data, table, job_config=job_config)
    job.result()

    destination_table = client.get_table(table)
    print(f"Total rows after load :  {destination_table.num_rows}")
