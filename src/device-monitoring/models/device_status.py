import app
from datetime import datetime, timedelta
from helpers import db_helpers


class DeviceStatus():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self):
        """ initialize """

    # get device status infromation
    def get_device_status(self):
        db = db_helpers.connect_mongo()
        documents = db.device_status_summary.find({})
        return documents
