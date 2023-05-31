from datetime import datetime, timedelta

import pandas as pd
import requests
from google.cloud import bigquery

from config import configuration, Config


def get_airqloud_sites(airqloud, tenant="airqo"):
    params = {"tenant": tenant, "airqloud": airqloud}

    if configuration.API_TOKEN:
        headers = {"Authorization": configuration.API_TOKEN}
        airqloud_response = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params, headers=headers
        )
    else:
        airqloud_response = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params)
    airqloud_response_json = airqloud_response.json()

    sites_details = airqloud_response_json["airqlouds"][0]["sites"]

    site_ids = [site["_id"] for site in sites_details]
    site_loc = [
        {"latitude": site["latitude"], "longitude": site["longitude"]}
        for site in sites_details
    ]
    site = [{key: value} for key, value in zip(site_ids, site_loc)]

    return site


def get_site_data(site, tenant="airqo"):
    site_id = list(site.keys())[-1]
    start_time = (
        (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    end_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    params = {
        "tenant": tenant,
        "site_id": site_id,
        "startTime": start_time,
        "endTime": end_time,
        "frequency": "hourly",
    }

    if configuration.API_TOKEN:
        headers = {"Authorization": configuration.API_TOKEN}
        event_response = requests.get(
            configuration.EVENTS_URI, params=params, headers=headers
        )
    else:
        event_response = requests.get(configuration.EVENTS_URI, params=params)
    event_response_json = event_response.json()

    site_data = event_response_json["measurements"]
    site_dd = []

    for data in site_data:
        try:
            pm2_5 = data.get('pm2_5').get('calibratedValue',
                                          data.get('pm2_5').get('value'))
        except:
            pm2_5 = None
        site_dd.append(
            {
                "time": data["time"],
                "latitude": site[site_id]["latitude"],
                "longitude": site[site_id]["longitude"],
                "pm2_5": pm2_5,
            }
        )
    return site_dd


def get_all_sites_data(airqloud, tenant="airqo"):
    airqloud_sites_id = get_airqloud_sites(airqloud, tenant)

    sites_data = []
    for site in airqloud_sites_id:
        site_data = get_site_data(site, tenant)
        sites_data.append(site_data)
    all_sites_data = [data for site in sites_data for data in site]
    return all_sites_data


def download_airqloud_data_from_bigquery(
    airqloud_id,
    start_time,
    end_time,
) -> pd.DataFrame:
    airqlouds_sites_table = f"`{Config.BIGQUERY_AIRQLOUDS_SITES}`"
    hourly_data_table = f"`{Config.BIGQUERY_HOURLY_DATA}`"
    sites_table = f"`{Config.BIGQUERY_SITES}`"

    # Get airqloud sites
    meta_data_query = (
        f" SELECT  {airqlouds_sites_table}.site_id "
        f" FROM {airqlouds_sites_table} "
        f" WHERE {airqlouds_sites_table}.airqloud_id = '{airqloud_id}' "
    )

    # Add site information
    meta_data_query = (
        f" SELECT {sites_table}.latitude , "
        f" {sites_table}.longitude , "
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
        f" WHERE {hourly_data_table}.timestamp >= '{start_time}' "
        f" AND {hourly_data_table}.timestamp <= '{end_time}' "
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

    if len(dataframe) == 0:
        return dataframe

    dataframe.dropna(inplace=True)
    return dataframe


def get_airqloud_data(airqloud_id) -> list:
    start_time = (datetime.utcnow() - timedelta(days=7)
                  ).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    airqloud_data = download_airqloud_data_from_bigquery(
        airqloud_id=airqloud_id, start_time=start_time, end_time=end_time
    )
    return airqloud_data.to_dict("records")
