from flask_restx import fields, Model

raw_data_model = Model(
    "RawDataModel",
    {
        "network": fields.String(required=True, description="Network identifier"),
        "device_names": fields.List(
            fields.String, required=True, description="List of device names"
        ),
        "device_category": fields.String(
            required=True, description="Category of the device"
        ),
        "startDateTime": fields.DateTime(
            required=True, description="Start date and time for data extraction"
        ),
        "endDateTime": fields.DateTime(
            required=True, description="End date and time for data extraction"
        ),
        "frequency": fields.String(
            required=True, description="Frequency of data i.e raw, hourly, daily"
        ),
    },
)

data_download_model = Model(
    "DataDownloadModel",
    {
        "startDateTime": fields.DateTime(
            required=True, description="Start date and time for data extraction"
        ),
        "endDateTime": fields.DateTime(
            required=True, description="End date and time for data extraction"
        ),
        "downloadType": fields.String(
            required=True, description="Data download format i.e csv"
        ),
        "outputFormat": fields.String(required=True, description="Output format"),
        "pollutants": fields.List(
            fields.String, required=True, description="List of pollutants i.e [pm2_5,]"
        ),
        "frequency": fields.String(
            required=True, description="Data frequency i.e hourly"
        ),
        "sites": fields.List(
            fields.String, description="List of site alphanumeric ids"
        ),
        "device_ids": fields.List(
            fields.String, description="List of alphanumeric device ids"
        ),
        "device_names": fields.List(fields.String, description="List of device names"),
        "weatherFields": fields.List(fields.String, description="List of device names"),
        "datatype": fields.String(
            required=True,
            description="Type of air quality data to download i.e calibrated or raw",
        ),
        "minimum": fields.Boolean(
            description="Download minimal data with less columns or not"
        ),
    },
)

data_export_model = Model(
    "DataExportModel",
    {
        "startDateTime": fields.DateTime(
            required=True, description="Start date and time for data extraction"
        ),
        "endDateTime": fields.DateTime(
            required=True, description="End date and time for data extraction"
        ),
        "userId": fields.String(required=True, description="Unique user identifier"),
        "frequency": fields.String(
            required=True, description="Data frequency i.e hourly"
        ),
        "exportFormat": fields.String(
            required=True, description="Data download format i.e csv"
        ),
        "outputFormat": fields.String(required=True, description="Output format"),
        "pollutants": fields.List(
            fields.String, required=True, description="List of pollutants i.e [pm2_5,]"
        ),
        "sites": fields.List(
            fields.String, description="List of site alphanumeric ids"
        ),
        "device_ids": fields.List(
            fields.String, description="List of alphanumeric device ids"
        ),
        "device_names": fields.List(fields.String, description="List of device names"),
        "meta_data": fields.List(fields.String, description="List of meta data fields"),
    },
)
