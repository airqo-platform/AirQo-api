from flask import Blueprint, request, jsonify
import logging
import app
from models import monitoring_site, graph
from bson import json_util, ObjectId
import json
from helpers import mongo_helpers
from helpers import helpers 

_logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/api/v1/data/download', methods = ['POST'])
def download_customised_data():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
               return {'message': 'No input data provided'}, 400      
        
        #input_data, errors = validate_inputs(input_data=json_data) //add server side validation
        #if not errors:       

        locations = json_data["locations"]        
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        file_type = json_data["fileType"]
        degree_of_cleanness = json_data["degreeOfClean"]
        organisation_name= json_data["organisation_name"]
        custom_chat_data = []
        datasets = [] #displaying multiple locations
        locations_devices =[]        
        for location in locations:
            devices = ms.get_location_devices_code( organisation_name, location['label'])
            for device in devices:
                device_code=device['DeviceCode']
                division = device['Division']
                parish = device['Parish']
                location_code= device['LocationCode']                
                values =[]
                labels =[]    
                device_results={}               
               
                filtered_data =  gr.get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
                if filtered_data:
                    for data in filtered_data: 
                        values.append(data['pollutant_value'])
                        labels.append(data['time'])
                    device_results= {'pollutant_values':values, 'labels':labels}                    
                    dataset = {'data':values, 'label':parish + ' '+ pollutant,'fill':False} 
                    datasets.append(dataset)      
                                                   
                
                custom_chat_data.append({'start_date':start_date, 'end_date':end_date, 'division':division, 
                 'parish':parish,'frequency':frequency, 'pollutant':pollutant, 
                 'location_code':location_code, 'chart_type':file_type,'chart_data':device_results, 'datasets':datasets})

            locations_devices.append(devices)        
            
        return jsonify({'results':custom_chat_data})
        


@dashboard_bp.route('/api/v1/dashboard/customisedchart/random/chartone', methods = ['GET'])
def get_random_location_hourly_customised_chart_data_2():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    device_code = 'A743BPWK'
    start_date = '2020-04-09T07:00:00.000000Z'
    end_date = '2020-05-12T07:00:00.000000Z'
    frequency = 'monthly'
    pollutant = 'PM 2.5'
    chart_type = 'pie'
    organisation_name= 'KCCA'
    parish = ' Wandegeya'
    location_code ='KCCA_KWPE_AQ05'
    division = 'Kawempe'
    custom_chat_data = []
    datasets = []
    colors =['green', 'blue', 'red','orange']
    custom_chart_title= 'Mean ' + frequency.capitalize() + ' '+ pollutant + '  for ' 
    locations_names = parish
    custom_chart_title = custom_chart_title +  locations_names + ' Between ' + helpers.convert_date_to_formated_str(helpers.str_to_date(start_date),frequency) + ' and ' + helpers.convert_date_to_formated_str(helpers.str_to_date(end_date),frequency)
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

    return jsonify({'results':custom_chat_data, 'datasets':datasets,'custom_chart_title':custom_chart_title})



@dashboard_bp.route('/api/v1/dashboard/customisedchart/random', methods = ['GET'])
def get_random_location_hourly_customised_chart_data():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    device_code = 'ANQ16PZJ'
    start_date = '2020-04-12T07:00:00.000000Z'
    end_date = '2020-04-14T07:00:00.000000Z'
    frequency = 'hourly'
    pollutant = 'PM 2.5'
    chart_type = 'line'
    organisation_name= 'KCCA'
    parish = 'Nakawa'
    location_code ='KCCA_NKWA_AQ01'
    division = 'Nakawa'
    custom_chat_data = []
    datasets = []
    colors =['green', 'blue', 'red','orange']
    custom_chart_title= 'Mean ' + frequency.capitalize() + ' '+ pollutant + '  for ' 
    locations_names = parish
    custom_chart_title = custom_chart_title +  locations_names + ' Between ' + helpers.convert_date_to_formated_str(helpers.str_to_date(start_date),frequency) + ' and ' + helpers.convert_date_to_formated_str(helpers.str_to_date(end_date),frequency)
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

    return jsonify({'results':custom_chat_data, 'datasets':datasets,'custom_chart_title':custom_chart_title})

@dashboard_bp.route('/api/v1/dashboard/customisedchart', methods = ['POST'])
def generate_customised_chart_data():
    ms = monitoring_site.MonitoringSite()
    gr = graph.Graph()
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
               return {'message': 'No input data provided'}, 400      
        
        #input_data, errors = validate_inputs(input_data=json_data) //add server side validation
        #if not errors:       

        locations = json_data["locations"]        
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]
        organisation_name= json_data["organisation_name"]
        custom_chat_data = []
        datasets = [] #displaying multiple locations
        locations_devices =[]
        colors =['green', 'blue', 'red','orange']
        custom_chart_title= 'Mean ' + frequency.capitalize() + ' '+ pollutant + '  for ' 
        locations_names = ','.join([str(location['label']) for location in locations])        
        custom_chart_title = custom_chart_title +  locations_names + ' Between ' + helpers.convert_date_to_formated_str(helpers.str_to_date(start_date),frequency) + ' and ' + helpers.convert_date_to_formated_str(helpers.str_to_date(end_date),frequency)
        for location in locations:            
            devices = ms.get_location_devices_code( organisation_name, location['label'])
            for device in devices:
                device_code=device['DeviceCode']
                division = device['Division']
                parish = device['Parish']
                location_code= device['LocationCode']
                #device_id = device['_id']
                values =[]
                labels =[] 
                background_colors= []   
                device_results={}               
                if chart_type == 'pie':
                    filtered_data = gr.get_piechart_data(device_code, start_date, end_date, frequency, pollutant)
                    if filtered_data:
                        for data in filtered_data: 
                            values.append(data['category_count'])
                            labels.append(data['category_name'])
                            background_colors.append(helpers.assign_color_to_pollutant_category(data['category_name']))  
                        device_results= {'pollutant_values':values, 'labels':labels}
                        color = colors.pop() 
                        dataset = {'data':values, 'label':parish + ' '+ pollutant,'backgroundColor':background_colors} 
                        datasets.append(dataset)

                        custom_chat_data.append({'start_date':start_date, 'end_date':end_date, 'division':division, 
                        'parish':parish,'frequency':frequency, 'pollutant':pollutant, 
                        'location_code':location_code, 'chart_type':chart_type,'chart_data':device_results, 'datasets':datasets, 'custom_chart_title':custom_chart_title})    
                    
                    #return jsonify({'results':custom_chat_data, 'datasets':datasets, 'custom_chart_title':custom_chart_title})
                else:                    
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
                    'location_code':location_code, 'chart_type':chart_type,'chart_data':device_results, 'datasets':datasets, 'custom_chart_title':custom_chart_title})

                locations_devices.append(devices)                     
            
        return jsonify({'results':custom_chat_data, 'datasets':datasets, 'custom_chart_title':custom_chart_title})
        
        #else:            
            #return jsonify({'inputs': json_data,'errors': errors})

@dashboard_bp.route('/api/v1/device/custom/chart/ANQ16PZJ', methods = ['GET'])
def get_hourly_custom_chart_data():
    device_code = 'ANQ16PZJ'
    start_date = '2020-04-12T07:00:00.000000Z'
    end_date = '2020-04-14T07:00:00.000000Z'
    frequency = 'hourly'
    pollutant = 'PM 2.5'
    results = json.loads(json_util.dumps(mongo_helpers.get_filtered_data(device_code, start_date, end_date, frequency, pollutant )))
    return jsonify({"results":results})



@dashboard_bp.route('/api/v1/dashboard/monitoringsites/locations', methods=['GET'])
def get_organisation_monitoring_site_locations():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        org_name= request.args.get('organisation_name')
        if org_name:
            monitoring_sites_locations=[]
            organisation_monitoring_sites_cursor = ms.get_monitoring_site_locations(org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites_locations.append(site)

            results = json.loads(json_util.dumps(monitoring_sites_locations))
            return jsonify({"airquality_monitoring_sites":results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})




@dashboard_bp.route('/api/v1/dashboard/monitoringsites', methods=['GET'])
def get_organisation_monitoring_site():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        org_name= request.args.get('organisation_name')
        if org_name:
            monitoring_sites=[]
            organisation_monitoring_sites_cursor = ms.get_all_organisation_monitoring_sites(org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites.append(site)

            results = json.loads(json_util.dumps(monitoring_sites))
            return jsonify({"airquality_monitoring_sites":results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})



@dashboard_bp.route('/api/v1/dashboard/historical/daily/devices', methods=['GET'])
def get_all_device_past_28_days_measurements():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        results=[]
        values =[]
        labels = []
        background_colors= []
        monitoring_site_measurements_cursor = ms.get_all_devices_past_28_days_measurements()
        for site in monitoring_site_measurements_cursor: 
            values.append(int(site["average_pm25"]))
            labels.append(site["Parish"])
            background_colors.append(helpers.set_pm25_category_background(site["average_pm25"]))            
            results.append(site)

        return jsonify({"results":{"average_pm25_values":values, "labels":labels, "background_colors": background_colors}})
    else:
        return jsonify({"error msg": "invalid request."})


@dashboard_bp.route('/api/v1/dashboard/divisions', methods=['GET'])
def get_divisions():
    divisions=[]
    division_cursor =  app.mongo.db.monitoring_site.find({},{"DeviceCode": 1, "Parish":1, "LocationCode":1,"Division":1, "_id": 0})
    #app.mongo.db.division.find()
    for division in division_cursor:
        divisions.append(division)

    results = json.loads(json_util.dumps(divisions))
    return jsonify({"divisions":results}), 200

@dashboard_bp.route('/api/v1/dashboard/exceedances', methods=['POST'])
def get_exceedances():
    gr = graph.Graph()
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400           
        pollutant = json_data["pollutant"]  
        standard = json_data["standard"]
        exceedances_data = gr.get_all_devices_past_28_days_exceedences(pollutant, standard)
        return jsonify(exceedances_data[0]['exceedences'])

@dashboard_bp.route('/api/v1/dashboard/exceedance_locations', methods=['GET'])
def get_exceedance_locations():
    return jsonify(mongo_helpers.get_locations())


@dashboard_bp.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'
