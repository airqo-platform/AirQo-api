import pandas as pd
from models import Devices, Events, BoundaryLayer, Site


def get_active_devices():
    """
    Get active devices with their site id
    """
    devices = Devices.get_devices()

    # store device details plus site id
    result = []
    for device in devices:
        site = {}
        if 'site' in device:
            site['device'] = device.get('name', '')
            site['device_number'] = device.get('device_number', '')
            site['device_latitude'] = device.get('latitude', '')
            site['device_longitude'] = device.get('longitude', '')
            site['site_id'] = device['site'].get('_id', '')
        else:
            print(f'device {device} does not have site information')
        result.append(site)
    return pd.DataFrame(result)


def get_sites_details():
    """
    Get site details. Returns sites metadata as a python pandas dataframe
    """
    sites = Site.get_sites()

    # store site details
    result = []

    for site in sites:
        data = {
            'site_id': site.get('_id', ''),
            'county': site.get('county', ''),
            'site_name': site.get('description', ''),
            'site_latitude': site.get('latitude', ''),
            'site_longitude': site.get('longitude', ''),
            'altitude': site.get('altitude', ''),
            'road_dist': site.get('distance_to_nearest_road', ''),
            'land_use': '',
            'road_intensity': '',
            'road_status': '',
            'location_activities': '',
            'aspect': site.get('aspect', ''),
            'landform_90': site.get('landform_90', ''),
            'landform_270': site.get('landform_270', ''),
            'greeness': site.get('greenness', ''),  # might need to pass time aspect
            'traffic_factor': '',
            'parish': site.get('parish', ''),
            'district': site.get('district', ''),
            'region': '',
            'sub_county': site.get('sub_county', ''),
            'distance_to_nearest_road': site.get('distance_to_nearest_road', ''),
            'distance_to_nearest_primary_road': site.get('distance_to_nearest_primary_road', ''),
            'distance_to_nearest_secondary_road': site.get('distance_to_nearest_secondary_road', ''),
            'distance_to_nearest_tertiary_road': site.get('distance_to_nearest_tertiary_road', ''),
            'distance_to_nearest_unclassified_road': site.get('distance_to_nearest_unclassified_road', ''),
            'distance_to_nearest_residential_road': site.get('distance_to_nearest_residential_road', ''),
            'bearing_to_kampala_center': site.get('bearing_to_kampala_center', ''),
            'distance_to_kampala_center': site.get('distance_to_kampala_center', '')
        }
        result.append(data)
    return pd.DataFrame(result)


def get_metadata():
    """Return device details and corresponding sites meta data"""

    devices = get_active_devices()
    sites = get_sites_details()

    # merge devices and sites dataframes using sites id
    metadata = pd.merge(devices, sites, how="inner", on=["site_id", "site_id"])

    return metadata.drop(columns=['site_id'])


def _transform_events(events):
    transformed_events = []
    for event in events:
        for value in event.get('values', []):
            transformed_event = {
                'pm2_5': value.get('pm2_5') and value.get('pm2_5').get('value'),
                'device_number': value.get('device_number'),
                'created_at': value.get('time'),
            }

            if transformed_event['created_at']:
                transformed_event['created_at'] = transformed_event['created_at'].isoformat()

            transformed_events.append(transformed_event)

    return pd.DataFrame(transformed_events)


def get_boundary_layer_data():
    boundaries = {boundary['hour']: boundary['height'] for boundary in BoundaryLayer().get_boundary_layer()}
    series = pd.Series(boundaries)
    return pd.DataFrame(series, columns=['height']).reset_index().rename(columns={'index': 'hour'})


def get_forecast_data():
    return _transform_events(Events().get_events_db())
