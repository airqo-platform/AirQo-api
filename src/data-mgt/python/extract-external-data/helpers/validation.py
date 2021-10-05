from marshmallow import Schema, fields, ValidationError,validate
import json
import typing as t

fields.Field.default_error_messages["required"] = "You missed something!"

class SpatialSchema(Schema):
    latitude = fields.Float(required=True, error_messages={"required": "latitude missing."}, validate=validate.Range(min=-90, max=90))
    longitude = fields.Float(required=True,error_messages={"required": "longitude missing."}, validate=validate.Range(min=-180, max=180))

class SpatialTemporalSchema(SpatialSchema):
    start_date = fields.Date(required=True, error_messages={"required": "datetime missing."})
    end_date = fields.Date(required=True, error_messages={"required": "datetime missing."})
		

def _filter_error_rows(errors: dict,validated_input: t.List[dict]) -> t.List[dict]:
    """
        Remove input data rows with errors.
    """

    indexes = errors.keys()
    # delete them in reverse order so that you
    # don't throw off the subsequent indexes.
    for index in sorted(indexes, reverse=True):
        del validated_input[index]

    return validated_input


def validate_inputs(input_data):
    """Check inputs against schema."""
    schema = SpatialTemporalSchema()

    errors = None
    try:
        schema.load(input_data)
    except ValidationError as exc:
        errors = exc.messages

    if errors:
        validated_input = _filter_error_rows(
            errors=errors,
            validated_input=input_data)
    else:
        validated_input = input_data

    return validated_input, errors

def validate_spatial_data(input_data):
    """Check inputs against spatial schema."""
    schema = SpatialSchema()

    errors = None
    try:
        schema.load(input_data)
    except ValidationError as exc:
        errors = exc.messages

    if errors:
        validated_input = _filter_error_rows(
            errors=errors,
            validated_input=input_data)
    else:
        validated_input = input_data

    return validated_input, errors


if __name__ == '__main__':
    input_data = {
    "latitude":"0.4018972",
    "longitude":"32.0104067" }
    validated_input_data, errors = validate_spatial_data(input_data)
    print(validated_input_data)
    print(errors)
