from api.models.base.base_model import BasePyMongoModel


class DeviceHourlyMeasurement(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="device_hourly_measurements")
