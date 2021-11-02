from marshmallow import Schema, fields


class ReportAttributeSchema(Schema):
    title = fields.String(required=True)
    type = fields.String(required=True)
    asset = fields.String(required=True)
    filters = fields.Dict(keys=fields.String())
    fields = fields.Dict(keys=fields.String(), required=True)
    group_by = fields.String()


class ReportSchema(Schema):
    name = fields.String(required=True)
    user_id = fields.String(required=True)
    attributes = fields.List(fields.Nested(ReportAttributeSchema), required=True)
