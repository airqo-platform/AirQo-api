import app
from datetime import datetime, timedelta
from helpers import db_helpers, utils
import requests
import math

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


    def get_all_devices_latest_status(self):
        """
        Gets the latest status of whether device was online or offline in the last two hours. 

        Args:
        Returns:
            A list of the records containing the status of devices interms of percentage, 
            the count of devices that were offline and online and the devices info.
        """       
        created_at = utils.str_to_date(utils.date_to_str(datetime.now().replace(microsecond=0, second=0, minute=0)-timedelta(hours=4)))
        #print(created_at)        
        query = {'$match':{ 'created_at': {'$gte': created_at} }}
        projection = { '$project': { '_id': 0, 'created_at': {'$dateToString':{ 'format': time_format, 'date': '$time', 'timezone':'Africa/Kampala'}}, }}
        sort_order= { '$sort' : { '_id' : -1  }}
        limit = {'$limit': 1}
        db = db_helpers.connect_mongo()
        #results = db.device_status_hourly_check_results.find().sort([('_id',-1)]).limit(1)
        results = db.device_status_hourly_check_results.find().sort([('$natural',-1)]).limit(1)
        #results = list(db.device_status_hourly_check_results.aggregate([query, projection,sort_order,limit]) )       
        return results
        
    
             
        #return response.json(), response.status_code  


    def get_all_devices(self):
        db = db_helpers.connect_mongo()
        results = list(db.device_status_summary.find({},{'_id':0}))
        return results

            
def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')

if __name__ == "__main__":
    dx = DeviceStatus()
    
