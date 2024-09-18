from marshmallow import Schema, fields


class DailyAveragesSchema(Schema):
    startDate = fields.DateTime(required=True)
    endDate = fields.DateTime(required=True)
    pollutant = fields.String(required=True)
    sites = fields.List(fields.String())


class DeviceDailyAveragesSchema(DailyAveragesSchema):
    devices = fields.List(fields.String(), required=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sites = None


class ExceedancesSchema(DailyAveragesSchema):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)


class DeviceExceedancesSchema(ExceedancesSchema):
    devices = fields.List(fields.String(), required=True)
