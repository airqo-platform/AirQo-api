from flask import Blueprint, request, jsonify
import logging
import app
from models import monitoring_site, graph, dashboard
from bson import json_util, ObjectId
import json
import pandas as pd
from helpers import mongo_helpers
from helpers import helpers

_logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/api/v1/analytics/dashboard/locations/pm25categorycount', methods=['GET'])
def get_pm25categorycount_for_locations():
    ms = monitoring_site.MonitoringSite()
    d = dashboard.Dashboard()
    if request.method == 'GET':
        org_name = request.args.get('organisation_name')
        if org_name:

            # organisation_monitoring_sites_cursor = ms.get_all_organisation_monitoring_sites(org_name)
            # results =  d.get_pm25_category_count(organisation_monitoring_sites_cursor)
            results = d.get_pm25_category_location_count_for_the_lasthour(
                org_name)
            if results:
                return jsonify(results[0]['pm25_categories'])
            else:
                return jsonify([])
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})


# @dashboard_bp.route('/api/v1/data/download', methods=['POST'])
# def download_customised_data():
#     ms = monitoring_site.MonitoringSite()
#     gr = graph.Graph()
#     if request.method == 'POST':
#         json_data = request.get_json()
#         if not json_data:
#             return {'message': 'No input data provided'}, 400

#         # input_data, errors = validate_inputs(input_data=json_data) //add server side validation
#         # if not errors:

#         locations = json_data["locations"]
#         start_date = json_data["startDate"]
#         end_date = json_data["endDate"]
#         frequency = json_data["frequency"]
#         pollutant = json_data["pollutant"]
#         file_type = json_data["fileType"]
#         degree_of_cleanness = json_data["degreeOfClean"]
#         organisation_name = json_data["organisation_name"]
#         custom_chat_data = []
#         datasets = []  # displaying multiple locations
#         locations_devices = []
#         for location in locations:
#             devices = ms.get_location_devices_code(
#                 organisation_name, location['label'])
#             for device in devices:
#                 device_code = device['DeviceCode']
#                 division = device['Division']
#                 parish = device['Parish']
#                 location_code = device['LocationCode']
#                 values = []
#                 labels = []
#                 device_results = {}

#                 filtered_data = gr.get_filtered_data(
#                     device_code, start_date, end_date, frequency, pollutant)
#                 if filtered_data:
#                     for data in filtered_data:
#                         values.append(data['pollutant_value'])
#                         labels.append(data['time'])
#                     device_results = {
#                         'pollutant_values': values, 'labels': labels}
#                     dataset = {'data': values, 'label': parish +
#                                ' ' + pollutant, 'fill': False}
#                     datasets.append(dataset)

#                 custom_chat_data.append({'start_date': start_date, 'end_date': end_date, 'division': division,
#                                          'parish': parish, 'frequency': frequency, 'pollutant': pollutant,
#                                          'location_code': location_code, 'chart_type': file_type, 'chart_data': device_results, 'datasets': datasets})

#             locations_devices.append(devices)

#         return jsonify({'results': custom_chat_data})


@dashboard_bp.route('/api/v1/analytics/data/download', methods=['POST', 'GET', 'PUT', 'DELETE', 'PATCH'])
def download_customised_data():
    # create an instance of the MonitoringSite class
    ms = monitoring_site.MonitoringSite()

    # create an instance of the Graph class
    gr = graph.Graph()
    if request.method != 'POST':
        return {'message': 'Method not allowed. The method is not allowed for the requested URL'}, 400
    else:
        json_data = request.get_json()
        download_type = request.args.get('type')
        if not json_data:
            return {'message': 'No input data provided'}, 400
        if not download_type:
            return {'message': 'Please specify the type of data you wish to download'}, 400
        if download_type not in ['csv', 'json']:
            return {'message': 'Invalid data type. Please specify csv or json'}, 400

        locations = json_data["locations"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        # select multiple pollutants
        pollutants = json_data["pollutants"]
        file_type = json_data["fileType"]
        degree_of_cleanness = json_data["degreeOfClean"]
        organisation_name = json_data["organisation_name"]
        custom_chat_data = []
        # datasets = {}  # displaying multiple locations
        datasets = []
        locations_devices = []
        for location in locations:
            devices = ms.get_location_devices_code(
                organisation_name, location['label'])
            # datasets[location['label']] = {}
            for device in devices:
                device_code = device['DeviceCode']
                division = device['Division']
                parish = device['Parish']
                location_code = device['LocationCode']
                values = []
                labels = []
                pollutant_list = []
                device_results = {}
                data_to_download = {}
                channel_ref = []

                # control how some of the data is accessed
                flag = 0
                # loop through pollutants selected by the user
                for pollutant in pollutants:
                    filtered_data = gr.get_filtered_data(
                        device_code, start_date, end_date, frequency, pollutant['value'])

                    data_to_download[pollutant['value']] = []
                    if filtered_data:
                        for data in filtered_data:
                            values.append(data['pollutant_value'])
                            if flag == 0:
                                labels.append(data['time'])
                                channel_ref.append(device_code)
                            pollutant_list.append(pollutant['value'])
                            data_to_download[pollutant['value']].append(
                                data['pollutant_value'])
                    flag = 1

                data_to_download['channel_ref'] = channel_ref
                data_to_download['device_code'] = device_code
                data_to_download['division'] = division
                data_to_download['parish'] = parish
                data_to_download['time'] = labels
                data_to_download['location_code'] = location_code
                data_to_download['start_date'] = start_date
                data_to_download['end_date'] = end_date
                data_to_download['frequency'] = frequency
                data_to_download['file_type'] = file_type
                data_to_download['owner'] = organisation_name
                data_to_download['location'] = location['label']

            # datasets[location['label']] = data_to_download
            datasets.append(data_to_download)

        # downloading json
        if download_type == 'json':
            return jsonify({'results': datasets})

        # downloading csv
        if download_type == 'csv':
            # print(json.dumps(datasets, indent=1))
            # json normalization to pandas datafrome
            tempp = pd.DataFrame()
            for location in locations:
                temp = pd.json_normalize(datasets, 'time', ['owner'])
                tempp['datetime'] = temp[0]

            for pollutant in pollutants:
                temp = pd.json_normalize(datasets, pollutant['label'], [
                    'owner', 'location', 'parish', 'division', 'frequency', 'location_code'])
                tempp['owner'] = temp['owner']
                tempp['location'] = temp['location']
                tempp['location_code'] = temp['location_code']
                tempp['parish'] = temp['parish']
                tempp['division'] = temp['division']
                tempp['frequency'] = temp['frequency']
                tempp[pollutant['label']] = temp[0]
            # FIELDS = ["location", "PM 2.5", "start_date"]
            # df = pd.json_normalize(datasets, max_level=1)
            # print(df)
            for location in locations:
                temp = pd.json_normalize(datasets, 'channel_ref', ['owner'])
                tempp['channel_ref'] = temp[0]
            print(tempp)

            final_data = tempp.to_json(orient='records')
            # buid a dataframe from data_to_download
            # df_new = pd.DataFrame(columns=['PM 2.5', 'PM 10', 'channel_ref'])
            # for item in datasets:
            #     df_new[item] = datasets[item]

            # print(df_new)
            # print(df_new.to_json(orient='columns'))
            # return jsonify({'results': datasets})
            return final_data


@dashboard_bp.route('/api/v1/analytics/dashboard/customisedchart/random/chartone', methods=['GET'])
def get_random_location_hourly_customised_chart_data_2():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    device_code = 'A743BPWK'
    start_date = '2020-04-09T07:00:00.000000Z'
    end_date = '2020-05-12T07:00:00.000000Z'
    frequency = 'monthly'
    pollutant = 'PM 2.5'
    chart_type = 'pie'
    organisation_name = 'KCCA'
    parish = ' Wandegeya'
    location_code = 'KCCA_KWPE_AQ05'
    division = 'Kawempe'
    custom_chat_data = []
    datasets = []
    colors = ['#7F7F7F', '#E377C2', '#17BECF',
              '#BCBD22', '#3f51b5']  # blue,cyan, olive,
    custom_chart_title = 'Mean ' + frequency.capitalize() + ' ' + \
        pollutant + '  for '
    locations_names = parish
    custom_chart_title = custom_chart_title + locations_names + ' Between ' + helpers.convert_date_to_formated_str(helpers.str_to_date(
        start_date), frequency) + ' and ' + helpers.convert_date_to_formated_str(helpers.str_to_date(end_date), frequency)
    values = []
    labels = []
    device_results = {}
    filtered_data = gr.get_filtered_data(
        device_code, start_date, end_date, frequency, pollutant)
    if filtered_data:
        for data in filtered_data:
            values.append(data['pollutant_value'])
            labels.append(data['time'])
        device_results = {'pollutant_values': values, 'labels': labels}
        color = colors.pop()
        dataset = {'data': values, 'label': parish + ' ' + pollutant,
                   'borderColor': color, 'backgroundColor': color, 'fill': False}
        datasets.append(dataset)

        custom_chat_data.append({'start_date': start_date, 'end_date': end_date, 'division': division,
                                 'parish': parish, 'frequency': frequency, 'pollutant': pollutant,
                                 'location_code': location_code, 'chart_type': chart_type, 'chart_data': device_results})

    return jsonify({'results': custom_chat_data, 'datasets': datasets, 'custom_chart_title': custom_chart_title})


@dashboard_bp.route('/api/v1/analytics/dashboard/customisedchart/random', methods=['GET'])
def get_random_location_hourly_customised_chart_data():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    device_code = 'ANQ16PZJ'
    start_date = '2020-04-12T07:00:00.000000Z'
    end_date = '2020-04-14T07:00:00.000000Z'
    frequency = 'hourly'
    pollutant = 'PM 2.5'
    chart_type = 'line'
    organisation_name = 'KCCA'
    parish = 'Nakawa'
    location_code = 'KCCA_NKWA_AQ01'
    division = 'Nakawa'
    custom_chat_data = []
    datasets = []
    colors = ['#7F7F7F', '#E377C2', '#17BECF', '#BCBD22', '#3f51b5']
    custom_chart_title = 'Mean ' + frequency.capitalize() + ' ' + \
        pollutant + '  for '
    locations_names = parish
    custom_chart_title = custom_chart_title +  locations_names  
    custom_chart_title_second_section = ' Between ' + helpers.convert_date_to_formated_str(helpers.str_to_date(start_date),frequency) + ' and ' + helpers.convert_date_to_formated_str(helpers.str_to_date(end_date),frequency)
    values =[]
    labels =[]    
    device_results={}
    filtered_data =  gr.get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
    if filtered_data:
        for data in filtered_data:
            values.append(data['pollutant_value'])
            labels.append(data['time'])
        device_results= {'pollutant_values':values, 'labels':labels}
        color = colors.pop() 
        dataset = {'data':values, 'label':parish + ' '+ pollutant,'borderColor' :color,'backgroundColor':color ,'fill':False} 
        datasets.append(dataset)          
                                                                            
        custom_chat_data.append({'start_date':start_date, 'end_date':end_date, 'division':division, 
            'parish':parish,'frequency':frequency, 'pollutant':pollutant, 
            'location_code':location_code, 'chart_type':chart_type,'chart_data':device_results})

    return jsonify({'results':custom_chat_data, 'datasets':datasets,'custom_chart_title':custom_chart_title, 'custom_chart_title_second_section':custom_chart_title_second_section})

@dashboard_bp.route('/api/v1/analytics/dashboard/customisedchart', methods = ['POST'])
def generate_customised_chart_data():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400

        # input_data, errors = validate_inputs(input_data=json_data) //add server side validation
        # if not errors:

        locations = json_data["locations"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]
        organisation_name = json_data["organisation_name"]
        custom_chat_data = []
        datasets = [] #displaying multiple locations
        locations_devices =[]
        colors =['#7F7F7F','#E377C2', '#17BECF', '#BCBD22','#3f51b5']
        custom_chart_title= 'Mean ' + frequency.capitalize() + ' '+ pollutant + '  for ' 
        locations_names = ','.join([str(location['label']) for location in locations])        
        custom_chart_title = custom_chart_title +  locations_names 
        custom_chart_title_second_section = ' Between ' + helpers.convert_date_to_formated_str(helpers.str_to_date(start_date),frequency) + ' and ' + helpers.convert_date_to_formated_str(helpers.str_to_date(end_date),frequency)
        for location in locations:            
            devices = ms.get_location_devices_code( organisation_name, location['label'])
            for device in devices:
                device_code = device['DeviceCode']
                division = device['Division']
                parish = device['Parish']
                location_code= device['LocationCode']                
                values =[]
                labels =[] 
                background_colors= []   
                device_results={}               
                if chart_type == 'pie':
                    filtered_data = gr.get_piechart_data(
                        device_code, start_date, end_date, frequency, pollutant)
                    if filtered_data:
                        for data in filtered_data:
                            values.append(data['category_count'])
                            labels.append(data['category_name'])
                            background_colors.append(
                                helpers.assign_color_to_pollutant_category(data['category_name']))
                        device_results = {
                            'pollutant_values': values, 'labels': labels}
                        color = colors.pop()
                        dataset = {'data': values, 'label': parish + ' ' +
                                   pollutant, 'backgroundColor': background_colors}
                        datasets.append(dataset)
                        custom_chat_data.append({'start_date':start_date, 'end_date':end_date, 'division':division, 
                        'parish':parish,'frequency':frequency, 'pollutant':pollutant, 
                        'location_code':location_code, 'chart_type':chart_type,'chart_data':device_results, 'datasets':datasets, 'custom_chart_title':custom_chart_title, 'custom_chart_title_second_section':custom_chart_title_second_section})    
                                        
                else:                    
                    filtered_data =  gr.get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
                    if filtered_data:
                        for data in filtered_data:
                            values.append(data['pollutant_value'])
                            labels.append(data['time'])
                        device_results = {
                            'pollutant_values': values, 'labels': labels}
                        color = colors.pop()
                        dataset = {'data': values, 'label': parish + ' ' + pollutant,
                                   'borderColor': color, 'backgroundColor': color, 'fill': False}
                        datasets.append(dataset)
                    measurement_units = '(µg/m3)'
                    if pollutant == 'NO2':
                        measurement_units = ' Concentration'    
                    chart_label = pollutant + measurement_units                              
                    
                    custom_chat_data.append({'start_date':start_date, 'end_date':end_date, 'division':division, 
                    'parish':parish,'frequency':frequency, 'pollutant':pollutant, 
                    'location_code':location_code, 'chart_type':chart_type,'chart_data':device_results, 
                    'datasets':datasets, 'custom_chart_title':custom_chart_title, 'chart_label':chart_label,  'custom_chart_title_second_section':custom_chart_title_second_section})

                locations_devices.append(devices)                     
            
        return jsonify({'results':custom_chat_data, 'datasets':datasets, 'custom_chart_title':custom_chart_title, 'custom_chart_title_second_section':custom_chart_title_second_section})
        
        #else:            
            #return jsonify({'inputs': json_data,'errors': errors})


@dashboard_bp.route('/api/v1/analytics/dashboard/monitoringsites/locations', methods=['GET'])
def get_organisation_monitoring_site_locations():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        org_name = request.args.get('organisation_name')
        if org_name:
            monitoring_sites_locations = []
            organisation_monitoring_sites_cursor = ms.get_monitoring_site_locations(
                org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites_locations.append(site)

            results = json.loads(json_util.dumps(monitoring_sites_locations))
            return jsonify({"airquality_monitoring_sites": results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})


@dashboard_bp.route('/api/v1/analytics/dashboard/monitoringsites', methods=['GET'])
def get_organisation_monitoring_site():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        org_name = request.args.get('organisation_name')
        pm25_category = request.args.get('pm25_category')
        if org_name:
            monitoring_sites = []
            organisation_monitoring_sites_cursor = ms.get_all_organisation_monitoring_sites(
                org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites.append(site)
            results = json.loads(json_util.dumps(monitoring_sites))
            if pm25_category:
                results = categorise_locations(results, pm25_category)

            return jsonify({"airquality_monitoring_sites": results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})


def categorise_locations(records, pm25_category):
    locations_with_good_pm25_levels = []
    locations_with_moderate_pm25_levels = []
    locations_with_UH4SG_pm25_levels = []
    locations_with_unhealthy_pm25_levels = []
    locations_with_very_unhealthy_pm25_levels = []
    locations_with_hazardous_pm25_levels = []
    locations_with_uncategorised_pm25_levels = []
    locations_with_all_pm25_levels = []

    for i in range(len(records)):
        if records[i]['Last_Hour_PM25_Value'] > 0.0 and records[i]['Last_Hour_PM25_Value'] <= 12.0:
            locations_with_good_pm25_levels.append(records[i])
        elif records[i]['Last_Hour_PM25_Value'] > 12.0 and records[i]['Last_Hour_PM25_Value'] <= 35.4:
            locations_with_moderate_pm25_levels.append(records[i])
        elif records[i]['Last_Hour_PM25_Value'] > 35.4 and records[i]['Last_Hour_PM25_Value'] <= 55.4:
            locations_with_UH4SG_pm25_levels.append(records[i])
        elif records[i]['Last_Hour_PM25_Value'] > 55.4 and records[i]['Last_Hour_PM25_Value'] <= 150.4:
            locations_with_unhealthy_pm25_levels.append(records[i])
        elif records[i]['Last_Hour_PM25_Value'] > 150.4 and records[i]['Last_Hour_PM25_Value'] <= 250.4:
            locations_with_very_unhealthy_pm25_levels.append(records[i])
        elif records[i]['Last_Hour_PM25_Value'] > 250.4 and records[i]['Last_Hour_PM25_Value'] <= 500.4:
            locations_with_hazardous_pm25_levels.append(records[i])
        else:
            locations_with_uncategorised_pm25_levels.append(records[i])

    if pm25_category == 'Good':
        return locations_with_good_pm25_levels
    elif pm25_category == 'Moderate':
        return locations_with_moderate_pm25_levels
    elif pm25_category == 'UHFSG':
        return locations_with_UH4SG_pm25_levels
    elif pm25_category == 'Unhealthy':
        return locations_with_unhealthy_pm25_levels
    elif pm25_category == 'VeryUnhealthy':
        return locations_with_very_unhealthy_pm25_levels
    elif pm25_category == 'Hazardous':
        return locations_with_hazardous_pm25_levels
    elif pm25_category == 'All':
        return records
    else:
        return locations_with_uncategorised_pm25_levels


@dashboard_bp.route('/api/v1/analytics/dashboard/historical/daily/devices', methods=['GET'])
def get_all_device_past_28_days_measurements():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        results = []
        values = []
        labels = []
        background_colors = []
        monitoring_site_measurements_cursor = ms.get_all_devices_past_28_days_measurements()
        for site in monitoring_site_measurements_cursor:
            values.append(int(site["average_pm25"]))
            labels.append(site["Parish"])
            background_colors.append(
                helpers.set_pm25_category_background(site["average_pm25"]))
            results.append(site)

        return jsonify({"results": {"average_pm25_values": values, "labels": labels, "background_colors": background_colors}})
    else:
        return jsonify({"error msg": "invalid request."})


@dashboard_bp.route('/api/v1/analytics/dashboard/divisions', methods=['GET'])
def get_divisions():
    divisions = []
    division_cursor = app.mongo.db.monitoring_site.find(
        {}, {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 0})
    # app.mongo.db.division.find()
    for division in division_cursor:
        divisions.append(division)

    results = json.loads(json_util.dumps(divisions))
    return jsonify({"divisions": results}), 200


@dashboard_bp.route('/api/v1/analytics/dashboard/exceedances', methods=['POST'])
def get_exceedances():
    gr = graph.Graph()
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]
        exceedances_data = gr.get_all_devices_past_28_days_exceedences(
            pollutant, standard)
        return jsonify(exceedances_data[0]['exceedences'])


@dashboard_bp.route('/api/v1/analytics/dashboard/exceedance_locations', methods=['GET'])
def get_exceedance_locations():
    return jsonify(mongo_helpers.get_locations())


@dashboard_bp.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'
