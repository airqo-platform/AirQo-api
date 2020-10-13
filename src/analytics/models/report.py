import app 
from datetime import datetime,timedelta
from helpers import mongo_helpers, helpers

class Report():
    """The class contains functionality for creating, retrieving report templates.

    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.

    """
    
    def __init__(self):
        """ initialize """ 

    # save default report template
    def save_default_report_template(self, user_id, report_name, report_body):        
        app.mongo.db.report_template.insert({
            "user_id": user_id,
            "report_date": datetime.now(),
            "report_type": "default",
            "report_name": report_name,
            "report_body": report_body
        })


    # get default report template
    def get_default_report_template(self):        
        documents = app.mongo.db.report_template.find({"report_type": "default"})
        return documents


    # save monthly report
    def save_monthly_report(self, user_id, report_name, report_body):    
        app.mongo.db.report_template.insert({
            "user_id": user_id,
            "report_date": datetime.now(),
            "report_name": report_name,
            "report_body": report_body
        })


    # get monthly
    def get_monthly_report(self, user_id):    
        documents = app.mongo.db.report_template.find({"user_id": str(user_id)})
        return documents


    # update previously saved report
    def update_default_report_template(self,report_body):    
        response = app.mongo.db.report_template.update_one(
            {'report_type': 'default'}, {'$set': {'report_body': report_body}})
        return response


    # update previously saved report
    def update_monthly_report(self, report_name, report_body):    
        response = app.mongo.db.report_template.update_one(
            {"report_name": report_name}, {'$set': {'report_body': report_body}})
        return response


    # delete previously saved planning space
    def delete_monthly_report(self, report_name):    
        response = app.mongo.db.report_template.delete_one({'report_name': report_name})
        return response

