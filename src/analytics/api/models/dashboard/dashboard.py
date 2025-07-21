from flask_restx import fields, Model

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
        "device_category": fields.String(description="Category of the device"),
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
