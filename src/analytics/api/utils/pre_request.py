from flask import request, jsonify, make_response
from .messages import TENANT_REQUIRED_MSG


class PreRequest:
    """
    This is the class that will host all static pre-request functions such as checking for tenant and authentication
    """
    TENANT_KEY = "tenant"
    IGNORE_TENANT_HEADER = ['/health', '/apidocs']

    @classmethod
    def check_tenant(cls):
        if request.method != 'OPTIONS':
            if request.path in cls.IGNORE_TENANT_HEADER:
                return None

            tenant = request.args.get(cls.TENANT_KEY)

            if not tenant:
                return make_response(jsonify({'message': TENANT_REQUIRED_MSG})), 400
