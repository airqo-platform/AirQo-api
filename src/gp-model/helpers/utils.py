def get_gp_predictions():
    '''
    returns pm 2.5 predictions given an array of space and time inputs
    '''
    try:
        client = MongoClient(MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        return {'message':'unable to connect to database', 'success':False}, 400

    db = client['airqo_netmanager_airqo']
    query = {}
    projection = {'_id': 0, 'latitude': 1, 'longitude': 1, 'predicted_value': 1, 'variance': 1, 'interval': 1}
    records = list(db.gp_predictions.find(query, projection))
    return records