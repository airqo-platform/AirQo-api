import requests
from datetime import datetime, timedelta
from pymongo import MongoClient
from config import configuration, environment


def get_airqloud_sites(airqloud, tenant='airqo'):

    # airqloud_url = 'https://platform.airqo.net/api/v1/devices/airqlouds'
    params = {'tenant': tenant,
              'airqloud': airqloud

              }

    if environment == 'staging':
        headers = {'Authorization': configuration.API_TOKEN}
        airqloud_response = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params, headers=headers)
    else:
        airqloud_response = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params)
    airqloud_response_json = airqloud_response.json()

    sites_details = airqloud_response_json['airqlouds'][0]['sites']

    site_ids = [site['_id'] for site in sites_details]

    return site_ids


def get_site_data(site_id, tenant='airqo'):
    start_time = (datetime.utcnow()-timedelta(days=7)
                  ).strftime('%Y-%m-%dT%H:%M:%SZ'),
    end_time = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    event_url = 'https://platform.airqo.net/api/v2/devices/events'
    params = {'tenant': tenant,
              'site_id': site_id,
              'startTime': start_time,
              'endTime': end_time,
              'frequency': 'hourly'
              }

    if environment == 'staging':
        headers = {'Authorization': configuration.API_TOKEN}
        event_response = requests.get(
            event_url, params=params, headers=headers)
    else:
        event_response = requests.get(event_url, params=params)
    event_response_json = event_response.json()

    site_data = event_response_json['measurements']
    site_dd = []

    for data in site_data:
        try:
            pm2_5 = data.get('pm2_5_calibrated_value', data['pm2_5_raw_value'])

        except:
            pm2_5 = None

        site_dd.append({'time': data['timestamp'], 'latitude': data['latitude'],
                        'longitude': data['longitude'], 'pm2_5': pm2_5})

    return site_dd


def get_all_sites_data(airqloud, tenant='airqo'):

    airqloud_sites_id = get_airqloud_sites(airqloud, tenant)

    sites_data = []
    for site_id in airqloud_sites_id:
        site_data = get_site_data(site_id, tenant)
        sites_data.append(site_data)
    all_sites_data = [data for site in sites_data for data in site]
    return all_sites_data
