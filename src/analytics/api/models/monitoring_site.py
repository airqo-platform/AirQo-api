from api.models.base.base_model import BasePyMongoModel


class MonitoringSite(BasePyMongoModel):
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
        print('results', results)
        for result in results:
            result["_id"] = str(result['_id'])

        return results
