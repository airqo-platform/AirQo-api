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
        "network": fields.String(description="Network identifier"),
        "device_category": fields.String(description="Category of the device"),
        "downloadType": fields.String(
            required=True, description="Data download format i.e csv"
        ),
        "outputFormat": fields.String(required=True, description="Output format"),
        "pollutants": fields.List(
            fields.String,
            required=True,
            description="List of pollutants i.e [pm2_5, pm10]",
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
        "metaDataFields": fields.List(
            fields.String, description="List of meta data fields"
        ),
        "weatherFields": fields.List(
            fields.String, description="List of weather fields"
        ),
        "datatype": fields.String(
            required=True,
            description="Type of air quality data to download i.e calibrated, raw, consolidated",
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

dashboard_chart_data_model = Model(
    "DashboardChartDataModel",
    {
        "startDate": fields.DateTime(
            required=True, description="Start date and time for data extraction"
        ),
        "endDate": fields.DateTime(
            required=True, description="End date and time for data extraction"
        ),
        "network": fields.String(description="Network identifier"),
        "organisation_name": fields.String(description="Organization identifier"),
        "pollutant": fields.String(required=True, description="Pollutants i.e pm2_5"),
        "frequency": fields.String(
            required=True, description="Data frequency i.e hourly"
        ),
        "sites": fields.List(
            fields.String, description="List of site alphanumeric ids"
        ),
        "chartType": fields.String(
            required=True,
            description="Type of chart to be displayed",
        ),
    },
)

forecast_data_model = Model(
    "ForecastDataModel",
    {
        "startDateTime": fields.DateTime(
            required=True, description="Start date and time for forecast data (ISO)"
        ),
        "endDateTime": fields.DateTime(
            required=True, description="End date and time for forecast data (ISO)"
        ),
        "country": fields.String(description="Country name i.e Uganda"),
        "city": fields.String(description="City name i.e Kampala"),
        "pollutants": fields.List(
            fields.String(),
            required=True,
            description="List of pollutants i.e [pm2_5, pm10]",
        ),
        "metaDataFields": fields.List(
            fields.String(),
            description="List of metadata fields i.e [latitude, longitude]",
        ),
        "weatherFields": fields.List(
            fields.String(),
            description="List of weather fields i.e [wind_speed, wind_direction]",
        )
        # "latitude": fields.Float(description="Latitude coordinate (decimal degrees)"),
        # "longitude": fields.Float(description="Longitude coordinate (decimal degrees)"),
    },
)
