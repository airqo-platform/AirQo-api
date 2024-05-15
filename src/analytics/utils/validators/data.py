from marshmallow import Schema, fields, validate, validates_schema, ValidationError, post_load


class DataExportSchema(Schema):
    startDateTime = fields.DateTime(required=True)
    endDateTime = fields.DateTime(required=True)
    frequency = fields.String(validate=validate.OneOf(["hourly", "daily", "raw"]))
    downloadType = fields.String(validate=validate.OneOf(["csv", "json"]))
    outputFormat = fields.String(validate=validate.OneOf(["airqo-standard", "aqcsv"]))
    pollutants = fields.List(
        fields.String(validate=validate.OneOf(["pm2_5", "pm10", "no2"])),
        validate=validate.Length(min=1),
    )
    sites = fields.List(fields.String())
    devices = fields.List(fields.String())
    airqlouds = fields.List(fields.String())

    @validates_schema
    def check_exclusive_fields_present(self, data, **kwargs):
        exclusive_fields = ["sites", "devices", "airqlouds"]
        count = sum(
            bool(data.get(field))
            for field in exclusive_fields
            if data.get(field) is not None
        )

        if count != 1:
            raise ValidationError(
                "Ensure to specify either a list of airqlouds, sites or devices only."
            )


class BulkDataExportSchema(DataExportSchema):
    userId = fields.String(required=True)
    metadata = fields.Dict()
    exportFormat = fields.String()

    @post_load
    def set_export_format(self, data, **kwargs):
        data["exportFormat"] = data.get("outputFormat", None)
        return data


class DataSummarySchema(Schema):
    startDateTime = fields.DateTime(required=True)
    endDateTime = fields.DateTime(required=True)
    airqloud = fields.String()
    cohort = fields.String()
    grid = fields.String()
