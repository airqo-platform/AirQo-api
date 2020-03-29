import app 

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

        
