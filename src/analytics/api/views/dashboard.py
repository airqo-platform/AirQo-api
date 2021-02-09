# Third-party libraries
from flask_restx import Resource
from flask import request
import pandas as pd

# Middlewares
from main import rest_api

from api.models import PM25LocationCategoryCount, MonitoringSite, DeviceHourlyMeasurement

from api.utils.http import Status
from api.utils.request_validators import validate_request_params, validate_request_json


@rest_api.route("/dashboard/locations/pm25categorycount")
class PM25CategoryLocationCount(Resource):

    def get(self):
        tenant = request.args.get("tenant")
        model = PM25LocationCategoryCount(tenant)
        results = list(model.sort("created_at", ascending=False).limit(1))

        response = results and results[0].get('pm25_categories') or []

        return response, Status.HTTP_200_OK


@rest_api.route("/data/download")
class DownloadCustomisedData(Resource):

    @validate_request_params('downloadType|required:data')
    @validate_request_json(
        'locations|required:list', 'startDate|required:datetime', 'endDate|required:datetime',
        'frequency|required:str', 'pollutants|required:list', 'fileType|required:data'
    )
    def post(self):
        # tenant = request.args.get("tenant")
        # download_type = request.args.get('downloadType')
        # json_data = request.get_json()
        # locations = json_data["locations"]
        # start_date = json_data["startDate"]
        # end_date = json_data["endDate"]
        # frequency = json_data["frequency"]
        # pollutants = json_data["pollutants"]
        # file_type = json_data["fileType"]
        #
        # ms_model = MonitoringSite(tenant)
        # dhm_model = DeviceHourlyMeasurement(tenant)
        #
        # datasets = []
        #
        # for location in locations:
        #     devices = ms_model.get_location_devices_code(location['label'])
        #     print("devices", devices)
        #
        #     for device in devices:
        #         device_code = device['DeviceCode']
        #         division = device['Division']
        #         parish = device['Parish']
        #         location_code = device['LocationCode']
        #         values = []
        #         labels = []
        #         pollutant_list = []
        #         data_to_download = {}
        #         channel_ref = []
        #
        #         # control how some of the data is accessed
        #         flag = 0
        #         # loop through pollutants selected by the user
        #         for pollutant in pollutants:
        #             filtered_data = dhm_model.get_filtered_data(
        #                 device_code, start_date, end_date, frequency, pollutant['value']
        #             )
        #
        #             data_to_download[pollutant['value']] = []
        #             print("filtered data", filtered_data)
        #             if filtered_data:
        #                 for data in filtered_data:
        #                     values.append(data['pollutant_value'])
        #                     if flag == 0:
        #                         labels.append(data['time'])
        #                         channel_ref.append(device_code)
        #                     pollutant_list.append(pollutant['value'])
        #                     data_to_download[pollutant['value']].append(
        #                         data['pollutant_value'])
        #             flag = 1
        #
        #         data_to_download['channel_ref'] = channel_ref
        #         data_to_download['device_code'] = device_code
        #         data_to_download['division'] = division
        #         data_to_download['parish'] = parish
        #         data_to_download['time'] = labels
        #         data_to_download['location_code'] = location_code
        #         data_to_download['start_date'] = start_date
        #         data_to_download['end_date'] = end_date
        #         data_to_download['frequency'] = frequency
        #         data_to_download['file_type'] = file_type
        #         data_to_download['owner'] = tenant
        #         data_to_download['location'] = location['label']
        #
        #         # This has been over indented compared to original
        #         datasets.append(data_to_download)
        #
        # # downloading json
        # if download_type == 'json':
        #     return {'results': datasets}, Status.HTTP_200_OK
        #
        # # downloading csv
        # if download_type == 'csv':
        #     # print(json.dumps(datasets, indent=1))
        #     # json normalization to pandas datafrome
        #     tempp = pd.DataFrame()
        #     for _ in locations:
        #         temp = pd.json_normalize(datasets, 'time', ['owner'])
        #         print("temp file", temp)
        #         tempp['datetime'] = temp[0]
        #
        #     for pollutant in pollutants:
        #         temp = pd.json_normalize(datasets, pollutant['label'], [
        #             'owner', 'location', 'parish', 'division', 'frequency', 'location_code'])
        #         tempp['owner'] = temp['owner']
        #         tempp['location'] = temp['location']
        #         tempp['location_code'] = temp['location_code']
        #         tempp['parish'] = temp['parish']
        #         tempp['division'] = temp['division']
        #         tempp['frequency'] = temp['frequency']
        #         tempp[pollutant['label']] = temp[0]
        #
        #     for _ in locations:
        #         temp = pd.json_normalize(datasets, 'channel_ref', ['owner'])
        #         tempp['channel_ref'] = temp[0]
        #     # print(tempp)
        #
        #     final_data = tempp.to_json(orient='records')
        #     return final_data, Status.HTTP_200_OK
        #
        # return {
        #            'status': 'error',
        #            'message': f'unknown data format {download_type}'
        #        }, Status.HTTP_400_BAD_REQUEST
        json_data = request.get_json()
        download_type = request.args.get('downloadType')
        # if not json_data:
        #     return {'message': 'No input data provided'}, 400
        # if not download_type:
        #     return {'message': 'Please specify the type of data you wish to download'}, 400
        # if download_type not in ['csv', 'json']:
        #     return {'message': 'Invalid data type. Please specify csv or json'}, 400

        tenant = request.args.get("tenant")
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
        ms_model = MonitoringSite(tenant)
        dhm_model = DeviceHourlyMeasurement(tenant)
        for location in locations:
            devices = ms_model.get_location_devices_code(
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
                    filtered_data = dhm_model.get_filtered_data(
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
            return {'results': datasets}, 200

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

