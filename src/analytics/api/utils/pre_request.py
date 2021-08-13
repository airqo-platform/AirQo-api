from itertools import chain
import re
from flask import request, jsonify, make_response
from .messages import TENANT_REQUIRED_MSG


class PreRequest:
    """
    This is the class that will host all static pre-request functions such as checking for tenant and authentication
    """
    TENANT_KEY = "tenant"
    DOCS_ENDPOINTS = ['/apidocs', '/flasgger', '/apispec']
    IGNORE_TENANT_HEADER = ['/health']
    COMBINED_IGNORE_TENANT_HEADER = f"({')|('.join(chain(DOCS_ENDPOINTS, IGNORE_TENANT_HEADER))})"

    @classmethod
    def check_tenant(cls):
        if request.method != 'OPTIONS':
            if re.match(cls.COMBINED_IGNORE_TENANT_HEADER, request.path):
                return None

            tenant = request.args.get(cls.TENANT_KEY)

            if not tenant:
                return make_response(jsonify({'message': TENANT_REQUIRED_MSG})), 400
