from typing import Dict, Any
from datetime import datetime, timezone
from marshmallow import (
    Schema,
    fields as ma_fields,
    validate,
    ValidationError,
    validates_schema,
)


def validate_mutually_exclusive_sites_devices_fields(data: Dict[str, Any]) -> None:
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


def validate_dates(data: Dict[str, Any]) -> None:
    """
    Validates that the 'endDateTime' is not earlier than 'startDateTime', and that 'startDateTime' is not set in the future.

    Args:
        data(Mapping[str, Any]): A dictionary-like object containing 'startDateTime' and 'endDateTime' keys, both expected to be datetime objects or types supporting comparison.

    Raises:
        ValidationError: If:
            - 'endDateTime' is earlier than 'startDateTime', or
            - 'startDateTime' is in the future relative to today's date.
    """
    start = data["startDateTime"]
    end = data["endDateTime"]

    if start.tzinfo is None or start.tzinfo.utcoffset(start) is None:
        raise ValidationError(
            "startDateTime must be timezone-aware.", field_name="startDateTime"
        )
    if end.tzinfo is None or end.tzinfo.utcoffset(end) is None:
        raise ValidationError(
            "endDateTime must be timezone-aware.", field_name="endDateTime"
        )

    if start > end:
        raise ValidationError(
            "startDateTime must not be greater than endDateTime.",
            field_name="startDateTime",
        )

    if start > datetime.now(timezone.utc):
        raise ValidationError(
            "startDateTime must not be greater than now.",
            field_name="startDateTime",
        )


def validate_mobile_device_filters(data: Dict[str, Any], **kwargs) -> None:
    """
    Validates that mobile devices use the correct frequency.

    Rules:
        - If `device_category` is "mobile", then `frequency` must be "raw".
        - Other device categories are not validated by this method.

    Args:
        data (dict): Input data containing at least `device_category` and `frequency`.

    Raises:
        ValidationError: If `device_category` is "mobile" and `frequency` is not "raw".
    """
    device_category = data.get("device_category")
    # TODO: Review bam workflow
    if device_category in {"mobile"}:
        frequency = data.get("frequency")
        if frequency != "raw":
            raise ValidationError(
                f"Invalid frequency {frequency!r} for device_category {device_category!r}. Must be 'raw'.",
                field_name="datatype",
            )


class RawDataSchema(Schema):
    network = ma_fields.String(
        required=True,
        validate=validate.OneOf(["airqo", "iqair", "airnow"], error="Invalid network."),
    )
    pollutants = ma_fields.List(
        ma_fields.String(),
        required=True,
        validate=validate.ContainsOnly(["pm2_5", "pm10"], error="Invalid pollutant."),
    )
    sites = ma_fields.List(ma_fields.String())
    device_ids = ma_fields.List(ma_fields.String())
    device_names = ma_fields.List(ma_fields.String())
    device_category = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["bam", "lowcost", "mobile"], error="Invalid device category."
        ),
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
    metaDataFields = ma_fields.List(
        ma_fields.String(),
        validate=validate.ContainsOnly(
            ["latitude", "longitude"], error="Invalid metadata fields."
        ),
    )
    weatherFields = ma_fields.List(
        ma_fields.String(),
        validate=validate.ContainsOnly(
            ["temperature", "humidity"], error="Invalid weather fields."
        ),
    )
    cursor = ma_fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "Cursor value for pagination."},
    )

    @validates_schema
    def validate_data_filter(self, data, **kwargs) -> None:
        """
        Schema-level validator to enforce mutual exclusivity between site and device filters.

        Ensures that the input data does not include both site-related and device-related filtering fields at the same time, as they are mutually exclusive.

        Args:
            data(dict): The input data being validated.
            **kwargs: Additional keyword arguments passed by Marshmallow.

        Raises:
            ValidationError: If both site and device fields are present in the input.
        """
        validate_mutually_exclusive_sites_devices_fields(data)

    @validates_schema
    def validate_request_dates(self, data, **kwargs) -> None:
        """
        Marshmallow schema-level validator to ensure date consistency.

        This method is triggered during schema validation and checks that 'endDateTime' is not earlier than 'startDateTime'.

        Args:
            data (dict): The input data being validated.
            **kwargs: Additional keyword arguments passed by Marshmallow.

        Raises:
            ValidationError: If 'endDateTime' is earlier than 'startDateTime'.
        """
        validate_dates(data)

    @validates_schema
    def validate_mobile_device_filters(self, data: Dict[str, Any], **kwargs) -> None:
        """
        Validates that mobile devices use the correct frequency.

        Rules:
            - If `device_category` is "mobile", then `frequency` must be "raw".
            - Other device categories are not validated by this method.

        Args:
            data (dict): Input data containing at least `device_category` and `frequency`.

        Raises:
            ValidationError: If `device_category` is "mobile" and `frequency` is not "raw".
        """
        return validate_mobile_device_filters(data)


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
            ["raw", "hourly", "daily", "weekly", "monthly", "yearly"],
            error="Invalid data frequency.",
        ),
    )
    device_category = ma_fields.String(
        required=True,
        validate=validate.OneOf(
            ["bam", "lowcost", "mobile"], error="Invalid device category."
        ),
    )
    network = ma_fields.String(
        validate=validate.OneOf(["airqo", "iqair", "metone"], error="Invalid network."),
    )
    sites = ma_fields.List(ma_fields.String())
    device_ids = ma_fields.List(ma_fields.String())
    device_names = ma_fields.List(ma_fields.String())
    metaDataFields = ma_fields.List(
        ma_fields.String(),
        validate=validate.ContainsOnly(
            ["latitude", "longitude"], error="Invalid metadata fields."
        ),
    )
    weatherFields = ma_fields.List(
        ma_fields.String(),
        validate=validate.ContainsOnly(
            ["temperature", "humidity"], error="Invalid weather fields."
        ),
    )
    minimum = ma_fields.Boolean()

    @validates_schema
    def validate_data_filter(self, data, **kwargs) -> None:
        """
        Schema-level validator to enforce mutual exclusivity between site and device filters.

        Ensures that the input data does not include both site-related and device-related filtering fields at the same time, as they are mutually exclusive.

        Args:
            data(dict): The input data being validated.
            **kwargs: Additional keyword arguments passed by Marshmallow.

        Raises:
            ValidationError: If both site and device fields are present in the input.
        """
        validate_mutually_exclusive_sites_devices_fields(data)

    @validates_schema
    def validate_request_dates(self, data, **kwargs) -> None:
        """
        Marshmallow schema-level validator to ensure date consistency.

        This method is triggered during schema validation and checks that 'endDateTime' is not earlier than 'startDateTime'.

        Args:
            data(dict): The input data being validated.
            **kwargs: Additional keyword arguments passed by Marshmallow.

        Raises:
            ValidationError: If 'endDateTime' is earlier than 'startDateTime'.
        """
        validate_dates(data)

    @validates_schema
    def validate_calibrated_frequency(self, data, **kwargs) -> None:
        """
        Validates that the 'frequency' field has an acceptable value when 'datatype' is 'calibrated'.

        When 'datatype' is set to 'calibrated', the 'frequency' must be one of the following:
        'hourly', 'daily', 'weekly', or 'yearly'. If 'frequency' is not within this set, a
        ValidationError is raised.

        Args:
            data(dict): The input data containing 'datatype' and 'frequency' fields.

        Raises:
            ValidationError: If 'datatype' is 'calibrated' and 'frequency' is not an allowed value.
        """
        if data.get("datatype") == "calibrated":
            allowed_freq = {"hourly", "daily", "weekly", "monthly", "yearly"}
            freq = data.get("frequency")
            if freq not in allowed_freq:
                raise ValidationError(
                    f"Invalid frequency {freq!r} for datatype 'calibrated'. Must be one of {sorted(allowed_freq)}.",
                    field_name="frequency",
                )

    @validates_schema
    def validate_device_category_datatype_combination(
        self, data: Dict[str, Any], **kwargs
    ) -> None:
        """
        Validates that devices of certain categories use the correct datatype.

        Rules:
            - If `device_category` is "bam" or "mobile", then `datatype` must be "raw".
            - Other device categories are not validated by this method.

        Args:
            data (dict): Input data containing at least `device_category` and `datatype`.

        Raises:
            ValidationError: If `device_category` is "bam" or "mobile" and `datatype` is not "raw".
        """
        device_category = data.get("device_category")
        # TODO: Review bam workflow
        if device_category in {"mobile"}:
            datatype = data.get("datatype")
            if datatype != "raw":
                raise ValidationError(
                    f"Invalid datatype {datatype!r} for device_category {device_category!r}. Must be 'raw'.",
                    field_name="datatype",
                )

        sites = data.get("sites", None)
        if sites:
            if device_category != "lowcost":
                raise ValidationError(
                    f"Invalid device category and sites metadata combination. Must be 'lowcost'.",
                    field_name="device_category",
                )

    @validates_schema
    def validate_mobile_device_filters(self, data: Dict[str, Any], **kwargs) -> None:
        """
        Validates that mobile devices use the correct frequency.

        Rules:
            - If `device_category` is "mobile", then `frequency` must be "raw".
            - Other device categories are not validated by this method.

        Args:
            data (dict): Input data containing at least `device_category` and `frequency`.

        Raises:
            ValidationError: If `device_category` is "mobile" and `frequency` is not "raw".
        """
        return validate_mobile_device_filters(data)


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
    def validate_data_filter(self, data, **kwargs) -> None:
        """
        Schema-level validator to enforce mutual exclusivity between site and device filters.

        Ensures that the input data does not include both site-related and device-related filtering fields at the same time, as they are mutually exclusive.

        Args:
            data(dict): The input data being validated.
            **kwargs: Additional keyword arguments passed by Marshmallow.

        Raises:
            ValidationError: If both site and device fields are present in the input.
        """
        validate_mutually_exclusive_sites_devices_fields(data)

    @validates_schema
    def validate_request_dates(self, data, **kwargs) -> None:
        """
        Marshmallow schema-level validator to ensure date consistency.

        This method is triggered during schema validation and checks that 'endDateTime' is not earlier than 'startDateTime'.

        Args:
            data(dict): The input data being validated.
            **kwargs: Additional keyword arguments passed by Marshmallow.

        Raises:
            ValidationError: If 'endDateTime' is earlier than 'startDateTime'.
        """
        validate_dates(data)
