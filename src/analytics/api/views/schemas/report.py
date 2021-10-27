from marshmallow import Schema, fields


class ReportSchema(Schema):
    name = fields.String(required=True)
    user_id = fields.String(required=True)
    body = fields.List(fields.String(), required=True)
