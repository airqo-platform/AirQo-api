from marshmallow import (
    Schema,
    fields as ma_fields,
    validate,
    ValidationError,
    validates_schema,
)


class RawDataSchema(Schema):
    network = ma_fields.String(
        required=True,
        validate=validate.OneOf(["airqo", "iqair", "airnow"], error="Invalid network."),
    )
    device_names = ma_fields.List(ma_fields.String(), required=True)
    device_category = ma_fields.String(
        required=True,
        validate=validate.OneOf(["bam", "lowcost"], error="Invalid device category."),
    )
    startDateTime = ma_fields.DateTime(required=True)
    endDateTime = ma_fields.DateTime(required=True)
    frequency = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["raw", "hourly", "daily", "weekly", "monthly"],
            error="Invalid data frequency.",
        ),
    )


class DataDownloadSchema(Schema):
    startDateTime = ma_fields.DateTime(required=True)
    endDateTime = ma_fields.DateTime(required=True)
    downloadType = ma_fields.String(
        required=True,
        validate=validate.OneOf(["csv", "json"], error="Invalid download type."),
    )
    outputFormat = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["airqo-standard", "aqcsv"], error="Invalid output format."
        ),
    )
    pollutants = ma_fields.List(
        ma_fields.String(),
        required=True,
        validate=validate.ContainsOnly(["pm2_5", "pm10"], error="Invalid pollutant."),
    )
    frequency = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["hourly", "daily", "raw", "weekly", "monthly", "yearly"],
            error="Invalid data frequency.",
        ),
    )
    # device_category = ma_fields.String(
    #     required=True,
    #     validate=validate.OneOf(["bam", "lowcost"], error="Invalid device category."),
    # )
    network = ma_fields.String(
        validate=validate.OneOf(["airqo", "iqair", "metone"], error="Invalid network."),
    )
    sites = ma_fields.List(ma_fields.String())
    device_ids = ma_fields.List(ma_fields.String())
    device_names = ma_fields.List(ma_fields.String())
    weatherFields = ma_fields.List(ma_fields.String())
    datatype = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["calibrated", "raw", "consolidated"],
            error="Invalid data type. Must be 'calibrated' or 'raw'.",
        ),
    )
    minimum = ma_fields.Boolean()

    @validates_schema
    def validate_mutually_exclusive_fields(self, data, **kwargs):
        provided = [
            field
            for field in ["sites", "device_ids", "device_names"]
            if field in data and data[field]
        ]

        if len(provided) != 1:
            raise ValidationError(
                "Exactly one of 'sites', 'device_ids', or 'device_names' must be provided.",
                field_names=["sites", "device_ids", "device_names"],
            )


class DataExportSchema(Schema):
    startDateTime = ma_fields.DateTime(required=True)
    endDateTime = ma_fields.DateTime(required=True)
    userId = ma_fields.String(required=True)
    frequency = ma_fields.String(
        required=True,
        validate=validate.OneOf(["hourly", "daily", "raw"], error="Invalid frequency."),
    )
    exportFormat = ma_fields.String(
        required=True,
        validate=validate.OneOf(["csv", "json"], error="Invalid download type."),
    )
    outputFormat = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["airqo-standard", "aqcsv"], error="Invalid output format."
        ),
    )
    pollutants = ma_fields.List(
        ma_fields.String(),
        required=True,
        validate=validate.ContainsOnly(["pm2_5", "pm10"], error="Invalid pollutant."),
    )
    sites = ma_fields.List(ma_fields.String())
    device_ids = ma_fields.List(ma_fields.String())
    device_names = ma_fields.List(ma_fields.String())
    metadata = ma_fields.List(ma_fields.String())

    @validates_schema
    def validate_mutually_exclusive_fields(self, data, **kwargs):
        provided = [
            field
            for field in ["sites", "device_ids", "device_names"]
            if field in data and data[field]
        ]

        if len(provided) != 1:
            raise ValidationError(
                "Exactly one of 'sites', 'device_ids', or 'device_names' must be provided.",
                field_names=["sites", "device_ids", "device_names"],
            )
