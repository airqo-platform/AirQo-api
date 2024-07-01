from marshmallow import Schema, fields


class AutoReportSchema(Schema):
    startTime = fields.DateTime(required=True)
    endTime = fields.DateTime(required=True)
    gridId = fields.String()
