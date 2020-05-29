from pymongo import MongoClient
import pymongo
import os

MONGO_URI = os.getenv("MONGO_URI")

def connect_mongo():
    '''
    Connects to MongoDB
    '''
    try:
        client = MongoClient(MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        print("Could not connect to MongoDB: %s" % e)

    #db = client['locate']
    db = client['geocensus_db']
    return db


def get_location_ref():
    '''
    Generates location reference
    '''
    db = connect_mongo()
    last_document = list(db.locations.find({}).sort([('_id', -1)]).limit(1))
    #last_document = list(db.collection.find({}).limit(1).sort([('$natural',-1)])
    if len(last_document)==0:
        loc_ref =1
    else:
        ref = last_document[0]['loc_ref']
        loc_ref = int(ref[4:])+1
        
    return 'loc_'+str(loc_ref)