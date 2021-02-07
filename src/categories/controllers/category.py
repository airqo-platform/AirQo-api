import base64
import datetime as dt
import logging
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from pymongo import MongoClient
import requests
import os
from routes import api
from helpers import convert_date
from flask import Blueprint, request, jsonify
from models import monitoring_site, pm25_location_categorycount


def get_pm25categorycount_for_locations(tenant):
    pm25category_location_count_results = []
    organisation_monitoring_sites_cursor = get_all_organisation_monitoring_sites(
        tenant)
    results = get_pm25_category_count(organisation_monitoring_sites_cursor)
    created_at = convert_date.str_to_date(
        convert_date.date_to_str(datetime.now()))
    record = {"pm25_categories": results,
              'created_at': created_at, "Organisation": tenant}
    pm25category_location_count_results.append(record)

    print(pm25category_location_count_results)

    save_pm25_locations_categorycount(
        pm25category_location_count_results, tenant)
    # else:
    #     print("error msg, organisation name wasn't supplied in the query string parameter.")
    return pm25category_location_count_results


def get_all_organisation_monitoring_sites(tenant):
    """
    Gets all the monitoring sites for the specified organisation. 
​
    Args:
        tenant: the name of the organisation whose monitoring sites are to be returned. 
​
    Returns:
        A list of the monitoring sites associated with the specified organisation name.
    """
    records = []
    MonitoringSite = monitoring_site.MonitoringSite(tenant)
    results = MonitoringSite.get_all()
    for result in results:
        if 'LatestHourlyMeasurement' in result:
            w = result['LatestHourlyMeasurement']
            last_hour_pm25_value = int(w[-1]['last_hour_pm25_value'])
            last_hour = convert_date.date_to_formated_str(w[-1]['last_hour'])
        else:
            last_hour_pm25_value = 0
            last_hour = ''
        obj = {"DeviceCode": result['DeviceCode'],
               'Parish': result['Parish'],
               'Division': result['Division'],
               'Last_Hour_PM25_Value': last_hour_pm25_value,
               'Latitude': result['Latitude'],
               'Longitude': result['Longitude'],
               'LocationCode': result['LocationCode'],
               'LastHour': last_hour,
               '_id': str(result['_id'])}
        records.append(obj)
    return records


def get_pm25_category_count(locations):
    locations_with_category_good = []
    locations_with_category_moderate = []
    locations_with_category_UH4SG = []  # unhealthy for sensitive group
    locations_with_category_unhealthy = []
    locations_with_category_very_unhealthy = []
    locations_with_category_hazardous = []
    locations_with_category_unknown = []

    for location in locations:
        pm25_conc_value = location['Last_Hour_PM25_Value']

        if pm25_conc_value > 0.0 and pm25_conc_value <= 12.0:
            locations_with_category_good.append(location['Parish'])
        elif pm25_conc_value > 12.0 and pm25_conc_value <= 35.4:
            locations_with_category_moderate.append(location['Parish'])
        elif pm25_conc_value > 35.4 and pm25_conc_value <= 55.4:
            locations_with_category_UH4SG.append(location['Parish'])
        elif pm25_conc_value > 55.4 and pm25_conc_value <= 150.4:
            locations_with_category_unhealthy.append(location['Parish'])
        elif pm25_conc_value > 150.4 and pm25_conc_value <= 250.4:
            locations_with_category_very_unhealthy.append(location['Parish'])
        elif pm25_conc_value > 250.4 and pm25_conc_value <= 500.4:
            locations_with_category_hazardous.append(location['Parish'])
        else:
            locations_with_category_unknown.append(location['Parish'])

    pm25_categories = [{'locations_with_category_good': {'category_name': 'Good', 'category_count': len(locations_with_category_good), 'category_locations': locations_with_category_good}},
                       {'locations_with_category_moderate': {'category_name': 'Moderate', 'category_count': len(
                           locations_with_category_moderate), 'category_locations': locations_with_category_moderate}},
                       {'locations_with_category_UH4SG': {'category_name': 'UH4SG', 'category_count': len(
                           locations_with_category_UH4SG), 'category_locations': locations_with_category_UH4SG}},
                       {'locations_with_category_unhealth': {'category_name': 'Unhealthy', 'category_count': len(
                           locations_with_category_unhealthy), 'category_locations': locations_with_category_unhealthy}},
                       {'locations_with_category_very_unhealthy': {'category_name': 'Very Unhealthy', 'category_count': len(
                           locations_with_category_very_unhealthy), 'category_locations': locations_with_category_very_unhealthy}},
                       {'locations_with_category_hazardous': {'category_name': 'Hazardous', 'category_count': len(
                           locations_with_category_hazardous), 'category_locations': locations_with_category_hazardous}},
                       {'locations_with_category_unknown': {'category_name': 'Other', 'category_count': len(locations_with_category_unknown), 'category_locations': locations_with_category_unknown}}]

    return pm25_categories


def save_pm25_locations_categorycount(data, tenant):
    """
    """
    PM25LocationsCategoryCount = pm25_location_categorycount.PM25LocationCategoryCount(
        tenant)
    for i in data:
        print(i)
        PM25LocationsCategoryCount.save(i)
        print('saved')
