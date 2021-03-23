from api.models.base.base_model import BasePyMongoModel
from api.utils.dates import date_to_str


class MonitoringSiteModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="monitoring_site")

    def get_location_devices_code(self, org_name, location_name):
        """
        Gets all the devices associated to the specified location name(parish name) for a particular organisation.

        Args:
            organisation_name: the name of the organisation whose monitoring site locations are to be returned.
            location_name: the name of the location i.e. parish whose devices are to be returned.
        Returns:
            A list of the devices (device codes) associated with the specified organisation name and location name.

        """

        query = {"$and": [{"Organisation": org_name or self.tenant.upper()}, {"Parish": location_name}]}
        results = list(self.collection.find(
            query,
            {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 1}
        ))
        for result in results:
            result["_id"] = str(result['_id'])

        return results

    def get_all_org_monitoring_sites(self, organisation_name):
        """
        Gets all the monitoring sites for the specified organisation.

        Args:
            organisation_name: the name of the organisation whose monitoring sites are to be returned.

        Returns:
            A list of the monitoring sites associated with the specified organisation name.
        """
        final_results = []
        results = list(self.find({"Organisation": organisation_name}))

        for result in results:
            if 'LatestHourlyMeasurement' in result:
                w = result['LatestHourlyMeasurement']
                last_hour_pm25_value = int(w[-1]['last_hour_pm25_value'])
                last_hour = str(date_to_str(w[-1]['last_hour'], format='%Y-%m-%d %H:%M'))
            else:
                last_hour_pm25_value = 0
                last_hour = ''

            final_results.append({
                "DeviceCode": result['DeviceCode'],
                'Parish': result['Parish'],
                'Division': result['Division'],
                'Last_Hour_PM25_Value': last_hour_pm25_value,
                'Latitude': result['Latitude'],
                'Longitude': result['Longitude'],
                'LocationCode': result['LocationCode'],
                'LastHour': last_hour,
                '_id': str(result['_id'])
            })

        return final_results
