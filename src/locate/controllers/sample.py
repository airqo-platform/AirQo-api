from flask import Blueprint
#from helpers import helper
import sys

locate_blueprint = Blueprint('locate_blueprint', __name__)

@locate_blueprint.route('/')
def index():
    print ('Ok', file=sys.stderr)
    return 'OK'