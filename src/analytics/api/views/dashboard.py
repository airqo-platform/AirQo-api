# Third-party libraries
from flask_restx import Resource
from flask import request
import pandas as pd

# Middlewares
from main import rest_api

from api.models import PM25LocationCategoryCount, MonitoringSite, DeviceHourlyMeasurement, DeviceDailyExceedances
from api.models.constants import CODE_LOCATIONS

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
        'frequency|required:str', 'pollutants|required:list', 'fileType|required:data', 'orgName|str'
    )
    def post(self):
        tenant = request.args.get("tenant")
        download_type = request.args.get('downloadType')
        json_data = request.get_json()
        locations = json_data["locations"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutants = json_data["pollutants"]
        file_type = json_data["fileType"]
        org_name = json_data["orgName"]

        ms_model = MonitoringSite(tenant)
        dhm_model = DeviceHourlyMeasurement(tenant)

        datasets = []

        for location in locations:
            devices = ms_model.get_location_devices_code(org_name or tenant, location['label'])

            for device in devices:
                device_code = device['DeviceCode']
                division = device['Division']
                parish = device['Parish']
                location_code = device['LocationCode']
                values = []
                labels = []
                pollutant_list = []
                data_to_download = {}
                channel_ref = []

                # control how some of the data is accessed
                flag = 0
                # loop through pollutants selected by the user
                for pollutant in pollutants:
                    filtered_data = dhm_model.get_filtered_data(
                        device_code, start_date, end_date, frequency, pollutant['value']
                    )

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
                data_to_download['owner'] = org_name or tenant
                data_to_download['location'] = location['label']

                # This has been over indented compared to original
                datasets.append(data_to_download)

        # downloading json
        if download_type == 'json':
            return {'results': datasets}, Status.HTTP_200_OK

        # downloading csv
        if download_type == 'csv':
            # print(json.dumps(datasets, indent=1))
            # json normalization to pandas datafrome
            tempp = pd.DataFrame()
            for _ in locations:
                temp = pd.json_normalize(datasets, 'time', ['owner'])
                if not temp.empty:
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
                if not temp.empty:
                    tempp[pollutant['label']] = temp[0]

            for _ in locations:
                temp = pd.json_normalize(datasets, 'channel_ref', ['owner'])
                if not temp.empty:
                    tempp['channel_ref'] = temp[0]

            final_data = tempp.to_json(orient='records')
            return final_data, Status.HTTP_200_OK

        return {
                   'status': 'error',
                   'message': f'unknown data format {download_type}'
               }, Status.HTTP_400_BAD_REQUEST


@rest_api.route('/dashboard/divisions')
class Divisions(Resource):

    def get(self):
        tenant = request.args.get('tenant')

        ms_model = MonitoringSite(tenant)

        divisions = ms_model.find(
            {},
            {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 0}
        )

        return {"divisions": list(divisions)}, Status.HTTP_200_OK


@rest_api.route('/dashboard/exceedances')
class Exceedances(Resource):

    @validate_request_json('pollutant|required:str', 'standard|required:str')
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]

        de_model = DeviceDailyExceedances(tenant)

        exceedances_data = de_model.get_last_28_days_exceedences(pollutant, standard)

        return exceedances_data and exceedances_data[0].get('exceedences') or [], Status.HTTP_200_OK


@rest_api.route('/dashboard/exceedance_locations')
class ExceedanceLocations(Resource):
    def get(self):
        return list(CODE_LOCATIONS.keys()), Status.HTTP_200_OK
