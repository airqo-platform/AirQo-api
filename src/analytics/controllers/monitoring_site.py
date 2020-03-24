from flask import Blueprint, request, jsonify
import logging
from app import mongo
from models.monitoring_site import MonitoringSite
from bson import json_util, ObjectId
import json

_logger = logging.getLogger(__name__)

monitoring_site_bp = Blueprint('monitoring_site', __name__)


@monitoring_site_bp.route('/api/v1/monitoringsites/', methods=['GET'])
def get_organisation_monitoring_site():
    ms = MonitoringSite()
    if request.method == 'GET':
        org_name= request.args.get('organisation_name')
        if org_name:
            monitoring_sites=[]
            organisation_monitoring_sites_cursor = ms.get_all_organisation_monitoring_sites(org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites.append(site)

            results = json.loads(json_util.dumps(monitoring_sites))
            return jsonify({"airquality monitoring sites":results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})