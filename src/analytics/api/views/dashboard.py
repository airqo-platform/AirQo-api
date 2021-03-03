from collections import OrderedDict

# Third-party libraries
from flasgger import swag_from
import flask_excel as excel
from flask_restx import Resource
from flask import request

# Middlewares
from main import rest_api

from api.models import (
    PM25LocationCategoryCountModel,
    MonitoringSiteModel,
    DeviceHourlyMeasurementModel,
    DeviceDailyExceedancesModel,
    DeviceDailyHistoricalAveragesModel
)
from api.models.constants import CODE_LOCATIONS

from api.utils.http import create_response, Status
from api.utils.request_validators import validate_request_params, validate_request_json
from api.utils.pollutants import (
    categorise_pm25_values,
    generate_pie_chart_data,
    PM_COLOR_CATEGORY,
    POLLUTANT_MEASUREMENT_UNITS,
    set_pm25_category_background,
    str_date_to_format_str
)


@rest_api.route("/dashboard/locations/pm25categorycount")
class PM25CategoryLocationCountResource(Resource):

    @swag_from('/api/docs/dashboard/pm25_location_count_get.yml')
    def get(self):
        tenant = request.args.get("tenant")
        model = PM25LocationCategoryCountModel(tenant)
        results = list(model.sort("created_at", ascending=False).limit(1))

        data = results and results[0].get('pm25_categories') or []

        return create_response("location count successfully fetched", data=data), Status.HTTP_200_OK


@rest_api.route("/data/download")
class DownloadCustomisedDataResource(Resource):

    @swag_from('/api/docs/dashboard/download_custom_data_post.yml')
    @validate_request_params('downloadType|required:data')
    @validate_request_json(
        'locations|required:list', 'startDate|required:datetime', 'endDate|required:datetime',
        'frequency|required:str', 'pollutants|required:list', 'orgName|str'
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
        org_name = json_data.get("orgName") or tenant

        ms_model = MonitoringSiteModel(tenant)
        dhm_model = DeviceHourlyMeasurementModel(tenant)

        formatted_data = []

        sites = list(ms_model.filter_by(Organisation=org_name).in_filter_by(Parish=locations).exec(
            {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 1}
        ))

        device_codes = []
        location_mapper = {}

        for site in sites:
            device_codes.append(site["DeviceCode"])
            location_mapper[site["DeviceCode"]] = site

        device_data = list(dhm_model.get_all_pollutant_values(
            device_codes, start_date=start_date, end_date=end_date, frequency=frequency
        ))

        for data in device_data:
            dataset = OrderedDict()
            site = location_mapper.get(data['deviceCode'])
            dataset['datetime'] = data['time']
            dataset['owner'] = org_name
            dataset['location'] = site['Parish']
            dataset['division'] = site['Division']
            dataset['frequency'] = frequency

            data['owner'] = org_name
            data['division'] = site['Division']
            data['location'] = site['Parish']
            data['frequency'] = frequency

            if "PM 2.5" in pollutants:
                dataset['pm25_value'] = data['pm25_value']

            if 'PM 10' in pollutants:
                dataset['pm10_value'] = data['pm10_value']

            if 'NO2' in pollutants:
                dataset['no2_value'] = data['no2_value']

            dataset['channel_ref'] = data['deviceCode']

            formatted_data.append(dataset)

        if download_type == 'json':
            return create_response("air-quality data download successful", data=formatted_data), Status.HTTP_200_OK

        if download_type == 'csv':
            return excel.make_response_from_records(formatted_data, 'csv', file_name=f'airquality-{frequency}-data')

        return create_response(f'unknown data format {download_type}', success=False), Status.HTTP_400_BAD_REQUEST


@rest_api.route('/dashboard/customised_chart')
class CustomisedChartResource(Resource):

    @swag_from('/api/docs/dashboard/customised_chart_post.yml')
    @validate_request_json(
        'locations|required:list', 'startDate|required:datetime', 'endDate|required:datetime',
        'frequency|required:str', 'pollutant|required:str', 'chartType|required:str', 'orgName|str'
    )
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        locations = json_data["locations"]
        start_date = json_data["startDate"]
        end_date = json_data["endDate"]
        frequency = json_data["frequency"]
        pollutant = json_data["pollutant"]
        chart_type = json_data["chartType"]
        org_name = json_data.get("orgName") or tenant

        custom_chart_title = f'Mean {frequency.capitalize()} {pollutant} for {", ".join(locations)}'
        custom_chart_title_second_section = f'Between {str_date_to_format_str(start_date, frequency)} and ' \
                                            f'{str_date_to_format_str(start_date, frequency)}'

        colors = ['#7F7F7F', '#E377C2', '#17BECF', '#BCBD22', '#3f51b5']

        if pollutant.lower() == 'pm 2.5':
            category_key = 'pm25'
            label_key = 'pm'

        elif pollutant.lower() == 'pm 10':
            category_key = 'pm10'
            label_key = 'pm'

        else:
            category_key = 'no2'
            label_key = 'no2'

        ms_model = MonitoringSiteModel(tenant)
        dhm_model = DeviceHourlyMeasurementModel(tenant)

        results = {
            "chart_type": chart_type,
            "custom_chart_title": custom_chart_title,
            "custom_chart_title_second_section": custom_chart_title_second_section,
            "chart_label": f'{pollutant} {POLLUTANT_MEASUREMENT_UNITS.get(label_key, "")}',
            "pollutant": pollutant,
            "start_date": start_date,
            "end_date": end_date,
            "frequency": frequency,
        }

        charts = []

        sites = list(ms_model.filter_by(Organisation=org_name).in_filter_by(Parish=locations).exec(
            {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 1}
        ))

        device_codes = [site["DeviceCode"] for site in sites]

        device_data = list(dhm_model.get_all_filtered_data(
            device_codes, start_date=start_date, end_date=end_date, frequency=frequency, pollutant=pollutant
        ))

        for device in sites:
            device_code = device['DeviceCode']
            division = device['Division']
            parish = device['Parish']
            location_code = device['LocationCode']

            dataset = {}

            site_data = list(filter(lambda data: data['deviceCode'] == device_code, device_data))

            if chart_type.lower() == 'pie':
                category_count = generate_pie_chart_data(
                    records=site_data,
                    key='pollutant_value',
                    pollutant=category_key
                )
                color = None
                try:
                    labels, values = zip(*category_count.items())
                except ValueError:
                    values = []
                    labels = []
                background_colors = [PM_COLOR_CATEGORY.get(label, '#808080') for label in labels]
                dataset['pieBackgroundColors'] = background_colors
            else:
                try:
                    values, labels = zip(*[(data['pollutant_value'], data['time']) for data in site_data])
                except ValueError:
                    values = []
                    labels = []

                color = colors.pop()

            dataset.update({
                'values': values,
                'labels': labels,
                'key_label': f'{parish} {pollutant}',
                'borderColor': color,
                'backgroundColor': color,
                'fill': False
            })

            chart_data = {
                "division": division,
                "location_code": location_code,
                "parish": parish,
                "dataset": dataset,
            }

            charts.append(chart_data)

        results["charts"] = charts
        return create_response("chart data successfully retrieved", data=results), Status.HTTP_200_OK


@rest_api.route('/dashboard/monitoring_sites/locations')
class MonitoringSiteLocationResource(Resource):

    @swag_from("/api/docs/dashboard/monitoring_site_location_get.yml")
    @validate_request_params('orgName|str')
    def get(self):
        tenant = request.args.get('tenant')
        org_name = request.args.get('orgName') or tenant

        ms_model = MonitoringSiteModel(tenant)

        org_monitoring_sites = ms_model.get_all_org_monitoring_sites(org_name)

        return create_response(
            "monitoring site location data successfully fetched",
            data=org_monitoring_sites
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/monitoring_sites')
class MonitoringSiteResource(Resource):

    @swag_from('/api/docs/dashboard/monitoring_site_get.yml')
    @validate_request_params('orgName|str', 'pm25Category|pmCategory')
    def get(self):
        tenant = request.args.get('tenant')
        org_name = request.args.get('orgName') or tenant
        pm25_category = request.args.get('pm25Category')

        ms_model = MonitoringSiteModel(tenant)

        org_monitoring_sites = ms_model.get_all_org_monitoring_sites(org_name)

        if pm25_category:
            org_monitoring_sites = categorise_pm25_values(org_monitoring_sites, pm25_category)

        return create_response(
            "monitoring site data successfully fetched",
            data=org_monitoring_sites
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/historical/daily/devices')
class DeviceDailyMeasurementsResource(Resource):

    def get(self):
        tenant = request.args.get('tenant')
        dha_model = DeviceDailyHistoricalAveragesModel(tenant)

        sites = dha_model.get_last_28_days_measurements()

        results = []
        values = []
        labels = []
        background_colors = []

        for site in sites:
            values.append(int(site["average_pm25"]))
            labels.append(site["Parish"])
            background_colors.append(set_pm25_category_background(site["average_pm25"]))
            results.append(site)

        return create_response(
            "daily measurements successfully fetched",
            data={
                "average_pm25_values": values,
                "labels": labels,
                "background_colors": background_colors
            }
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/divisions')
class DivisionsResource(Resource):

    def get(self):
        tenant = request.args.get('tenant')

        ms_model = MonitoringSiteModel(tenant)

        divisions = ms_model.find(
            {},
            {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 0}
        )

        return create_response(
            "division successfully fetched",
            data={"divisions": list(divisions)}
        ),  Status.HTTP_200_OK


@rest_api.route('/dashboard/exceedances')
class ExceedancesResource(Resource):

    @validate_request_json('pollutant|required:str', 'standard|required:str')
    def post(self):
        tenant = request.args.get('tenant')

        json_data = request.get_json()
        pollutant = json_data["pollutant"]
        standard = json_data["standard"]

        de_model = DeviceDailyExceedancesModel(tenant)

        exceedances_data = de_model.get_last_28_days_exceedences(pollutant, standard)

        return create_response(
            "exceedance data successfully fetched",
            data=exceedances_data and exceedances_data[0].get('exceedences') or []
        ), Status.HTTP_200_OK


@rest_api.route('/dashboard/exceedance_locations')
class ExceedanceLocationsResource(Resource):
    def get(self):
        return create_response(
            "Exceedance location data successfully fetched",
            data=list(CODE_LOCATIONS.keys())
        ), Status.HTTP_200_OK
