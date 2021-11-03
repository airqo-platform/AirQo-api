from marshmallow import Schema, fields as marshmallow_fields


class ReportAttributeSchema(Schema):
    title = marshmallow_fields.String(required=True)
    type = marshmallow_fields.String(required=True)
    asset = marshmallow_fields.String(required=True)
    filters = marshmallow_fields.Dict(keys=marshmallow_fields.String())
    fields = marshmallow_fields.Dict(keys=marshmallow_fields.String(), required=True)
    group_by = marshmallow_fields.String()


class ReportPeriodSchema(Schema):
    is_relative = marshmallow_fields.Boolean(required=True)
    value = marshmallow_fields.Int()
    unit = marshmallow_fields.String()
    start_date = marshmallow_fields.DateTime()
    end_date = marshmallow_fields.DateTime()
    str_rep = marshmallow_fields.String()


class ReportSchema(Schema):
    name = marshmallow_fields.String(required=True)
    user_id = marshmallow_fields.String(required=True)
    period = marshmallow_fields.Nested(ReportPeriodSchema, required=True)
    attributes = marshmallow_fields.List(marshmallow_fields.Nested(ReportAttributeSchema), required=True)
