from marshmallow import (
    Schema,
    fields as ma_fields,
    validate,
    ValidationError,
    validates_schema,
)


def validate_mutually_exclusive_sites_devices_fields(data):
    """
    Ensures that exactly one of 'sites', 'device_ids', or 'device_names' is provided in the input data.

    This validation enforces mutual exclusivity — if none or more than one of the fields are provided
    and non-empty, a ValidationError is raised.

    Args:
        data (dict): The input data being validated.

    Raises:
        ValidationError: If zero or more than one of the mutually exclusive fields are present and non-empty.
    """
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
            ["raw", "hourly", "daily", "weekly", "monthly", "yearly"],
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
    datatype = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["calibrated", "raw", "consolidated"],
            error="Invalid data type. Must be 'calibrated' or 'raw'.",
        ),
    )
    frequency = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["hourly", "daily", "raw", "weekly", "monthly", "yearly"],
            error="Invalid data frequency.",
        ),
    )
    device_category = ma_fields.String(
        validate=validate.OneOf(["bam", "lowcost"], error="Invalid device category."),
    )
    network = ma_fields.String(
        validate=validate.OneOf(["airqo", "iqair", "metone"], error="Invalid network."),
    )
    sites = ma_fields.List(ma_fields.String())
    device_ids = ma_fields.List(ma_fields.String())
    device_names = ma_fields.List(ma_fields.String())
    weatherFields = ma_fields.List(ma_fields.String())
    minimum = ma_fields.Boolean()

    @validates_schema
    def validate_data_filter(self, data, **kwargs):
        validate_mutually_exclusive_sites_devices_fields(data)

    @validates_schema
    def validate_calibrated_frequency(self, data, **kwargs):
        """
        Validates that the 'frequency' field has an acceptable value when 'datatype' is 'calibrated'.

        When 'datatype' is set to 'calibrated', the 'frequency' must be one of the following:
        'hourly', 'daily', 'weekly', or 'yearly'. If 'frequency' is not within this set, a
        ValidationError is raised.

        Args:
            data (dict): The input data containing 'datatype' and 'frequency' fields.

        Raises:
            ValidationError: If 'datatype' is 'calibrated' and 'frequency' is not an allowed value.
        """
        if data.get("datatype") == "calibrated":
            allowed_freq = {"hourly", "daily", "weekly", "monthly", "yearly"}
            freq = data.get("frequency")
            if freq not in allowed_freq:
                raise ValidationError(
                    f"Invalid frequency '{freq}' for datatype 'calibrated'. Must be one of {sorted(allowed_freq)}.",
                    field_name="frequency",
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
    def validate_data_filter(self, data, **kwargs):
        validate_mutually_exclusive_sites_devices_fields(data)
