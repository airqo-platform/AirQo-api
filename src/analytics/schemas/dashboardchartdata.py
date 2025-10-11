from marshmallow import (
    Schema,
    fields as ma_fields,
    validate,
    ValidationError,
    validates_schema,
)


def validate_dates(data):
    if data["endDate"] < data["startDate"]:
        raise ValidationError("endDate must not be earlier than startDate.", "endDate")


class DashboardChartDataSchema(Schema):
    network = ma_fields.String(
        validate=validate.OneOf(["airqo", "iqair", "airnow"], error="Invalid network."),
    )
    organisation_name = ma_fields.String()
    device_category = ma_fields.String(
        validate=validate.OneOf(["bam", "lowcost"], error="Invalid device category."),
    )
    pollutant = ma_fields.String(
        required=True,
        validate=validate.OneOf(["pm2_5", "pm10"], error="Invalid pollutant."),
    )
    sites = ma_fields.List(ma_fields.String(), required=True)
    startDate = ma_fields.DateTime(required=True)
    endDate = ma_fields.DateTime(required=True)
    frequency = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["raw", "hourly", "daily", "weekly", "monthly", "yearly"],
            error="Invalid data frequency.",
        ),
    )
    chartType = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["line", "pie", "bar"],
            error="Invalid chart type",
        ),
    )
    metaDataFields = ma_fields.List(
        ma_fields.String(),
        validate=validate.ContainsOnly(
            ["latitude", "longitude", "site_id"], error="Invalid metadata fields."
        ),
    )

    @validates_schema
    def validate_request_dates(self, data, **kwargs):
        validate_dates(data)
