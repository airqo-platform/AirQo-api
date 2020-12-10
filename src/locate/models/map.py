import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from helpers import db_helpers

class Map():
    '''
    The class handles functionality for the planning space.
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    '''

    def __init__(self):
        ''' initialize ''' 

    def save_locate_map(self, tenant, user_id, space_name, plan):
        '''
        Saves current planning space
        '''
        db = db_helpers.connect_mongo(tenant)
        db.locate_map.insert({
            "user_id": user_id,
            "space_name": space_name,
            "plan": plan
        })


    def get_locate_map(self, tenant, user_id):
        '''
        Retrieves previously saved planning space
        '''
        db = db_helpers.connect_mongo(tenant)
        documents = db.locate_map.find({"user_id": str(user_id)})
        return documents

    def plan_space_exist(self, tenant, user_id, space_name):
        '''
        check if planning space name already exits for a given user. Avoid duplicates
        '''
        db = db_helpers.connect_mongo(tenant)
        documents = db.locate_map.find({"$and": [{"user_id":str(user_id)}, {"space_name":space_name}]})
        return documents.count()


    def update_locate_map(self, tenant, space_name, updated_plan):
        '''
        Updates previously saved planning space
        '''
        db = db_helpers.connect_mongo(tenant)
        response = db.locate_map.update_one(
            {"space_name": space_name}, {'$set': {'plan': updated_plan}})
        return response


    def delete_locate_map(self, tenant, space_name):
        '''
        Deletes previously sved planning space
        '''
        db = db_helpers.connect_mongo(tenant)
        response = db.locate_map.delete_one({'space_name': space_name})
        return response