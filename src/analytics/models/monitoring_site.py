import app 
from datetime import datetime,timedelta
from helpers import mongo_helpers
from helpers import helpers

class MonitoringSite():
    """The summary line for a class docstring should fit on one line.

    If the class has public attributes, they may be documented here
    in an ``Attributes`` section and follow the same formatting as a
    function's ``Args`` section.

    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.

    """

    def __init__(self):
        """ initialize """ 
                
    def get_monitoring_site(self, ):
        """
        gets the monitoring site with the specified id
        """
        

    def get_all_organisation_monitoring_sites(self, organisation_name):
        """
        Gets all the monitoring sites for the specified organisation. 

        Args:
            organisation_name: the name of the organisation whose monitoring sites are to be returned. 

        Returns:
            A list of the monitoring sites associated with the specified organisation name.
        """
        results = list(app.mongo.db.monitoring_site.find({"Organisation":organisation_name}))
        return results


    def get_device_past_28_days_measurements(self, device_code):
        """
        Gets all the daily measurements for the deviceo for the past 28 days from current day. 

        Args:
            device_code: the code of the devices whose measurements are to be returned. 

        Returns:
            A list of the daily measurements for the past 28 days.
        """
        endtime = helpers.date_to_str(datetime.now())
        starttime = helpers.date_to_str(datetime.now() - timedelta(days=28))        
        results = mongo_helpers.get_filtered_data(device_code,starttime, endtime,'daily','PM 2.5')
        #results = list(app.mongo.db..find({"deviceCode":device_code}))
        return results


    def get_all_devices_past_28_days_measurements(self):
        """
        Gets all the daily measurements for the deviceo for the past 28 days from current day. 

        Args:
            device_code: the code of the devices whose measurements are to be returned. 

        Returns:
            A list of the daily measurements for the past 28 days.
        """       
        results = list(app.mongo.db.device_daily_historical_averages.find({},{ "_id": 0}))
        #results = list(app.mongo.db..find({"deviceCode":device_code}))
        return results

        
