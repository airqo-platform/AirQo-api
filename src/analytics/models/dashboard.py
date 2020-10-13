import app 
from helpers import mongo_helpers, helpers
from datetime import datetime,timedelta

class Dashboard():
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
                
           

    def get_all_organisation_monitoring_sites(self, organisation_name):
        """
        Gets all the monitoring sites for the specified organisation. 

        Args:
            organisation_name: the name of the organisation whose monitoring sites are to be returned. 

        Returns:
            A list of the monitoring sites associated with the specified organisation name.
        """
        results_x =[]
        results = list(app.mongo.db.monitoring_site.find({"Organisation":organisation_name},
        {"DeviceCode": 1, "Parish":1, "LocationCode":1,"Division":1,"LatestHourlyMeasurement":1, "_id": 0}))
        for result in results:
            obj = {"DeviceCode": result['DeviceCode'], 
                    'Parish': result['Parish'],
                    'Division': result['Division'],
                    'Last_Hour_PM25_Value': result['LatestHourlyMeasurement'][-1]['last_hour_pm25_value']}
            results_x.append(obj)
        return results_x



    def get_pm25_category_count(self, locations):
         locations_with_category_good =[]
         locations_with_category_moderate =[]
         locations_with_category_UH4SG = [] #unhealthy for sensitive group
         locations_with_category_unhealthy =[]
         locations_with_category_very_unhealthy =[]
         locations_with_category_hazardous =[]
         locations_with_category_unknown = []


         for location in locations:
             pm25_conc_value = location['Last_Hour_PM25_Value']

             if pm25_conc_value >0.0 and pm25_conc_value <=12.0:                
                locations_with_category_good.append(location['Parish'])
             elif pm25_conc_value >12.0 and pm25_conc_value <=35.4:                
                locations_with_category_moderate.append(location['Parish'])
             elif pm25_conc_value > 35.4 and pm25_conc_value <= 55.4:                
                locations_with_category_UH4SG.append(location['Parish'])
             elif pm25_conc_value > 55.4 and pm25_conc_value <= 150.4:                
                locations_with_category_unhealthy.append(location['Parish'])
             elif pm25_conc_value > 150.4 and pm25_conc_value <= 250.4:                
                locations_with_category_very_unhealthy.append(location['Parish'])
             elif pm25_conc_value > 250.4 and pm25_conc_value <=500.4:                
                locations_with_category_hazardous.append(location['Parish'])
             else:                
                locations_with_category_unknown.append(location['Parish'])



         pm25_categories = [ {'locations_with_category_good':{'category_name':'Good','category_count':len(locations_with_category_good), 'category_locations':locations_with_category_good }},
                {'locations_with_category_moderate':{'category_name':'Moderate','category_count': len(locations_with_category_moderate), 'category_locations':locations_with_category_moderate}}, 
                {'locations_with_category_UH4SG':{'category_name':'UH4SG','category_count':len(locations_with_category_UH4SG), 'category_locations':locations_with_category_UH4SG}}, 
                {'locations_with_category_unhealth':{'category_name':'Unhealthy','category_count':len(locations_with_category_unhealthy), 'category_locations':locations_with_category_unhealthy}},
                {'locations_with_category_very_unhealthy':{'category_name':'Very Unhealthy','category_count':len(locations_with_category_very_unhealthy), 'category_locations':locations_with_category_very_unhealthy}}, 
                {'locations_with_category_hazardous':{'category_name':'Hazardous','category_count':len(locations_with_category_hazardous), 'category_locations':locations_with_category_hazardous}}, 
                {'locations_with_category_unknown':{'category_name':'Other','category_count':len(locations_with_category_unknown), 'category_locations':locations_with_category_unknown}}]

         return pm25_categories
        

    def get_pm25_category_location_count_for_the_lasthour(self, organisation_name):
        """
        Gets all the pm25 for the last hour. 

        Args:
            pollutant: the pollutant whose exceedences are to be returned. 
            standard: the standard to use to get the exceedences.

        Returns:
            A list of the number of daily exceedences for the specified pollutant and standard in the past 28 days.
        """       
        results = list(app.mongo.db.pm25_location_categorycount.find().sort([('$natural',-1)]).limit(1))        
        return results

        
