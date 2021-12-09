from config import connect_mongo

class Map():
    '''
    The class handles functionality for the planning space.
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    '''

    def __init__(self, tenant):
        self.db = connect_mongo(tenant) 

    def save_locate_map(self, user_id, space_name, plan):
        '''
        Saves current planning space
        '''
        
        self.db.locate_map.insert({
            "user_id": user_id,
            "space_name": space_name,
            "plan": plan
        })


    def get_locate_map(self, user_id):
        '''
        Retrieves previously saved planning space
        '''
        documents = self.db.locate_map.find({"user_id": str(user_id)})
        return documents

    def plan_space_exist(self, user_id, space_name):
        '''
        check if planning space name already exits for a given user. Avoid duplicates
        '''
        documents = self.db.locate_map.find({"$and": [{"user_id":str(user_id)}, {"space_name":space_name}]})
        return len(list(documents))

    def update_locate_map(self, user_id, space_name, updated_plan):
        '''
        Updates previously saved planning space
        '''
        response = self.db.locate_map.update_one(
            {"$and": [{'user_id': user_id}, {'space_name': space_name}]}, {'$set': {'plan': updated_plan}})
        return response


    def delete_locate_map(self, user_id, space_name):
        '''
        Deletes previously sved planning space
        '''
        response = self.db.locate_map.delete_one({"$and": [{'user_id': user_id}, {'space_name': space_name}]})
        return response