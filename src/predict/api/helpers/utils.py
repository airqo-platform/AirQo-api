from datetime import datetime, timedelta

from dotenv import load_dotenv

from config.constants import connect_mongo

load_dotenv()
db = connect_mongo()


def get_all_gp_predictions():
    """
    returns pm 2.5 predictions for all airqloud
    """

    today = datetime.today()
    query = {"created_at": {"$gt": today - timedelta(minutes=60)}}
    projection = {'_id': 0,
                  'latitude': 1,
                  'longitude': 1,
                  'predicted_value': 1,
                  'variance': 1,
                  'interval': 1,
                  'airqloud': 1,
                  'created_at': 1,
                  'airqloud_id': 1,
                  'values': 1}
    records = list(db.gp_predictions.find(query, projection))
    return records


def get_gp_predictions(airqloud):
    """
    returns pm 2.5 predictions for a particular airqloud
    """
    if airqloud is None:
        records = get_all_gp_predictions()
    else:
        query = {'airqloud': airqloud}
        projection = {'_id': 0,
                      'latitude': 1,
                      'longitude': 1,
                      'predicted_value': 1,
                      'variance': 1,
                      'interval': 1,
                      'airqloud': 1,
                      'created_at': 1,
                      'airqloud_id': 1,
                      'values': 1}
        records = list(db.gp_predictions.find(query, projection))
    return records


def get_gp_predictions_id(aq_id):
    """
    returns pm 2.5 predictions for a particular airqloud
    """

    query = {'airqloud_id': aq_id}
    projection = {'_id': 0, 'latitude': 1, 'longitude': 1, 'predicted_value': 1, 'variance': 1, 'interval': 1,
                  'airqloud': 1, 'created_at': 1, 'airqloud_id': 1}
    records = list(db.gp_predictions.find(query, projection))
    return records


if __name__ == '__main__':
    print('main')
