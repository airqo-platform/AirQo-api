import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os #name 'os' is not defined

MONGO_URI = os.getenv('MONGO_URI')
#_config.MONGO_URI


class Map():
    '''
    The class handles functionality for the planning space.
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    '''

    def __init__(self):
        ''' initialize ''' 

    def save_locate_map(self, user_id, space_name, plan):
        '''
        Saves current planning space
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        db.locate_map.insert({
            "user_id": user_id,
            "space_name": space_name,
            "plan": plan
        })


    def get_locate_map(self, user_id):
        '''
        Retrieves previously saved planning space
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        documents = db.locate_map.find({"user_id": str(user_id)})
        return documents


    def update_locate_map(self, space_name, updated_plan):
        '''
        Updates previously saved planning space
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        response = db.locate_map.update_one(
            {"space_name": space_name}, {'$set': {'plan': updated_plan}})
        return response


    def delete_locate_map(self, space_name):
        '''
        Deletes previously sved planning space
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        response = db.locate_map.delete_one({'space_name': space_name})
        return response


    