import requests
from datetime import datetime, timedelta
from pymongo import MongoClient
from config import configuration, environment


def get_airqloud_sites(airqloud, tenant='airqo'):

    params = {'tenant': tenant,
              'airqloud': airqloud

              }

    if configuration.API_TOKEN:
        headers = {'Authorization': configuration.API_TOKEN}
        airqloud_response = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params, headers=headers)
    else:
        airqloud_response = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params)
    airqloud_response_json = airqloud_response.json()

    sites_details = airqloud_response_json['airqlouds'][0]['sites']

    site_ids = [site['_id'] for site in sites_details]
    site_loc = [{'latitude': site['latitude'],
                 'longitude': site['longitude']} for site in sites_details]
    site = [{key: value} for key, value in zip(site_ids, site_loc)]

    return site


def get_site_data(site, tenant='airqo'):
    site_id = list(site.keys())[-1]
    start_time = (datetime.utcnow()-timedelta(days=7)
                  ).strftime('%Y-%m-%dT%H:%M:%SZ'),
    end_time = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    params = {'tenant': tenant,
              'site_id': site_id,
              'startTime': start_time,
              'endTime': end_time,
              'frequency': 'hourly'
              }

    if configuration.API_TOKEN:
        headers = {'Authorization': configuration.API_TOKEN}
        event_response = requests.get(
            configuration.EVENTS_URI, params=params, headers=headers)
    else:
        event_response = requests.get(configuration.EVENTS_URI, params=params)
    event_response_json = event_response.json()

    site_data = event_response_json['measurements']
    site_dd = []

    for data in site_data:
        try:
            pm2_5 = data.get('pm2_5').get('calibratedValue',
                                          data.get('pm2_5').get('value'))
        except:
            pm2_5 = None
        site_dd.append({'time': data['time'], 'latitude': site[site_id]['latitude'],
                        'longitude': site[site_id]['longitude'], 'pm2_5': pm2_5})
    return site_dd


def get_all_sites_data(airqloud, tenant='airqo'):

    airqloud_sites_id = get_airqloud_sites(airqloud, tenant)

    sites_data = []
    for site in airqloud_sites_id:
        site_data = get_site_data(site, tenant)
        sites_data.append(site_data)
    all_sites_data = [data for site in sites_data for data in site]
    return all_sites_data
