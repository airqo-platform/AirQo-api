# This is the file that is invoked to start up a development server.
# It gets a copy of the app from the package and runs it.
# This won’t be used in production

import os
import sys
import requests

from flask import jsonify, request, make_response, send_from_directory

ROOT_PATH = os.path.dirname(os.path.realpath(__file__))
os.environ.update({'ROOT_PATH': ROOT_PATH})
sys.path.append(os.path.join(ROOT_PATH, 'modules'))
