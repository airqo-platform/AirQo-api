from app import mongo


class MonitoringSite():
    """ 
     
    """

    def __init__(self):
        """ initialize """ 
                
    def get_monitoring_site(self, ):
        """
        gets the monitoring site with the specified id
        """
        

    def get_all_organisation_monitoring_sites(self, organisation_name):
        """
        gets all the monitoring sites for the specified organisation.
        """
        results = mongo.db.monitoring_site.find({"Organisation":organisation_name})
        return results

        
