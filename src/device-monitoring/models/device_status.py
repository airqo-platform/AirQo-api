import app
from datetime import datetime, timedelta
from helpers import db_helpers
import requests

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


    def get_device_channel_status(self):
        BASE_API_URL='https://data-manager-dot-airqo-250220.appspot.com/api/v1/data/'
        #https://data-manager-dot-airqo-250220.appspot.com/api/v1/data/channels
        #https://data-manager-dot-airqo-250220.appspot.com/api/v1/data/feeds/recent/672528
        api_url = '{0}{1}'.format(BASE_API_URL,'channels')
        print(api_url)
        response = requests.get(api_url)  
        results = response.json()
        for channel in results:
            print(channel['id'])
        return response.json(), response.status_code  

if __name__ == "__main__":
    dx = DeviceStatus()
    dx.get_device_channel_status()
