# Third-party libraries
from flask import request
from flask_restx import Resource

from api.models import (
    EventsModel,
)
from api.utils.http import create_response, Status

# Middlewares
from main import rest_api


@rest_api.route("/map/latest-readings")
class MapDataResource(Resource):
    def get(self):
        tenant = request.args.get("tenant", None)

        data = EventsModel.bigquery_latest_measurements(
            tenant=tenant, not_null_values=["latitude", "longitude"]
        )

        return (
            create_response("Successful", data=data),
            Status.HTTP_200_OK,
        )
