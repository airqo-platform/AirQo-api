# Third-party libraries
from flask_restx import Resource
from flask import request

# Middlewares
from main import rest_api

from api.models import PM25LocationCategoryCount

from api.utils.http import Status


@rest_api.route("/dashboard/locations/pm25categorycount")
class PM25CategoryLocationCount(Resource):

    def get(self):
        tenant = request.args.get("tenant")
        model = PM25LocationCategoryCount(tenant)
        results = list(model.sort("created_at", ascending=False).limit(1))

        response = results and results[0].get('pm25_categories') or []

        return response, Status.HTTP_200_OK
