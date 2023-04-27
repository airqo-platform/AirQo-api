import requests
from datetime import datetime
import pandas as pd
import numpy as np
import gpflow
from gpflow import set_trainable
from config import connect_mongo
from config import configuration, environment
import argparse
from threading import Thread
from shapely.geometry import Point, Polygon
from helpers.get_data import get_pm_data
from data.data import get_airqloud_sites, get_site_data, get_all_sites_data
from data.preprocess import data_to_df, drop_missing_value, preprocess
pd.set_option('mode.chained_assignment', None)


def get_airqloud_polygon(tenant, airqloud):
    '''
    Gets the geometric polygon of a given airqloud
    '''
    params = {'tenant': tenant,
              'name': airqloud
              }
    if configuration.API_TOKEN:
        headers = {'Authorization': configuration.API_TOKEN}
        coords = requests.get(configuration.VIEW_AIRQLOUD_URI, params=params, headers=headers).json()[
            'airqlouds'][0]['location']['coordinates']
    else:
        coords = requests.get(configuration.VIEW_AIRQLOUD_URI, params=params).json()[
            'airqlouds'][0]['location']['coordinates']
    geo = {'type': 'Polygon', 'coordinates': coords}
    polygon = Polygon([tuple(l) for l in geo['coordinates'][0]])
    min_long, min_lat, max_long, max_lat = polygon.bounds
    return polygon, min_long, max_long, min_lat, max_lat


def train_model(X, Y, airqloud):
    '''
    Creates a model and trains it using given data
    '''
    print('training model function')

    if X.shape[0] > 9000:
        Xtraining = X[::2, :]
        Ytraining = Y[::2, :]
    else:
        Xtraining = X
        Ytraining = Y.reshape(-1, 1)

    print('Number of rows in Xtraining for ' +
          airqloud + ' airqloud', Xtraining.shape[0])

    if airqloud == 'kampala':
        k = gpflow.kernels.RBF(
            lengthscales=np.ones(Xtraining.shape[1])) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining),
                              kernel=k, mean_function=None)
        set_trainable(m.kernel.kernels[0].lengthscales, False)
    elif airqloud == 'kawempe':
        k = gpflow.kernels.RBF(variance=625) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining),
                              kernel=k, mean_function=None)
        set_trainable(m.kernel.kernels[0].variance, False)
    elif airqloud == 'kira':
        k = gpflow.kernels.RBF() + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining),
                              kernel=k, mean_function=None)
    elif airqloud == 'jinja':
        k = gpflow.kernels.RBF(
            lengthscales=np.ones(Xtraining.shape[1])) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining),
                              kernel=k, mean_function=None)
    elif airqloud == 'makindye':
        k = gpflow.kernels.RBF(variance=625) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining),
                              kernel=k, mean_function=None)
    else:
        k = gpflow.kernels.RBF(variance=625) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining),
                              kernel=k, mean_function=None)

    if airqloud != 'kampala':
        m.likelihood.variance.assign(400)
        set_trainable(m.likelihood.variance, False)

    opt = gpflow.optimizers.Scipy()

    def objective_closure():
        return - m.log_marginal_likelihood()

    opt_logs = opt.minimize(
        objective_closure, m.trainable_variables, options=dict(maxiter=100))

    return m


def point_in_polygon(row, polygon):
    '''
    Checks whether a geometric point lies within a given polygon
    '''
    mypoint = Point(row.longitude, row.latitude)
    if polygon.contains(mypoint):
        return 'True'
    else:
        return 'False'


def predict_model(m, tenant, airqloud, aq_id, poly, x1, x2, y1, y2):
    '''
    Makes the predictions and stores them in a database
    '''
    time = datetime.now().replace(microsecond=0, second=0,
                                  minute=0).strftime('%Y-%m-%dT%H:%M:%SZ')

    longitudes = np.linspace(x1, x2, 100)
    latitudes = np.linspace(y1, y2, 100)
    locations = np.meshgrid(longitudes, latitudes)
    locations_flat = np.c_[locations[0].flatten(), locations[1].flatten()]

    df = pd.DataFrame(locations_flat, columns=['longitude', 'latitude'])
    df['point_exists'] = df.apply(
        lambda row: point_in_polygon(row, poly), axis=1)
    new_df = df[df.point_exists == 'True']
    new_df.drop('point_exists', axis=1, inplace=True)
    new_df.reset_index(drop=True, inplace=True)
    new_df['time'] = time
    new_df_preprocess = preprocess(new_df)
    pred_set = new_df_preprocess.values
    new_array = np.asarray(new_df)
    mean, var = m.predict_f(pred_set)

    means = mean.numpy().flatten()
    variances = var.numpy().flatten()
    std_dev = np.sqrt(variances)
    interval = 1.96 * std_dev

    result = []
    result_builder = {'airqloud': airqloud,
                      'airqloud_id': aq_id, 'created_at': datetime.now()}
    values = []
    for i in range(pred_set.shape[0]):
        values.append({'latitude': new_array[i][1],
                      'longitude': new_array[i][0],
                       'predicted_value': means[i],
                       'variance': variances[i],
                       'interval': interval[i]
                       })
    result_builder['values'] = values
    result.append(result_builder)

    db = connect_mongo(tenant)
    collection = db['gp_predictions']

    if collection.count_documents({'airqloud': airqloud}) != 0:
        collection.delete_many({'airqloud': airqloud})

    collection.insert_many(result)

    return result


def periodic_function(tenant, airqloud, aq_id):
    '''
    Re-trains the model regularly
    '''

    poly, min_long, max_long, min_lat, max_lat = get_airqloud_polygon(
        tenant, airqloud)
    all_sites_data = get_all_sites_data(airqloud=airqloud, tenant=tenant)
    if len(all_sites_data) >= 1:
        train_data_df = data_to_df(data=all_sites_data)
        train_data_df = drop_missing_value(train_data_df)
        train_data_preprocessed = preprocess(df=train_data_df)
        X_features = np.asarray(
            train_data_preprocessed.drop('pm2_5', axis=1).values)
        Y_target = np.asarray(train_data_preprocessed['pm2_5'].values)
        X = X_features
        Y = Y_target.reshape(-1, 1)
        m = train_model(X_features, Y_target, airqloud)
        predict_model(m, tenant, airqloud, aq_id, poly,
                      min_long, max_long, min_lat, max_lat)
    else:
        print('No training data available for ' + airqloud +
              ' airqloud within the specified time range.')


def get_all_airqlouds(tenant):
    '''
    Returns a list of all the airqlouds for a particuar tenant
    '''
    params = {'tenant': tenant}

    if configuration.API_TOKEN != None:
        headers = {'Authorization': configuration.API_TOKEN}
        airqlouds = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params, headers=headers).json()['airqlouds']
    else:
        airqlouds = requests.get(
            configuration.VIEW_AIRQLOUD_URI, params=params).json()['airqlouds']
    names = [aq['name'] for aq in airqlouds]
    aq_ids = [aq['_id'] for aq in airqlouds]
    # Esxcluding Country level AirQloud
    exclude = ['kenya', 'uganda', 'cameroon', 'senegal', 'gulu']
    names_update = set(names).difference(set(exclude))
    exclude_ind = list(map(names.index, exclude))
    aq_ids_update = [aq_ind for ind, aq_ind in enumerate(
        aq_ids) if ind not in exclude_ind]
    return names_update, aq_ids_update


if __name__ == '__main__':
    airqloud_names, aq_ids = get_all_airqlouds('airqo')
    print(airqloud_names)
    parser = argparse.ArgumentParser(description='save gpmodel prediction.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')

    args = parser.parse_args()
    for index, name in enumerate(airqloud_names):
        exec(
            f'thread{index} = Thread(target=periodic_function, args = [args.tenant, name, aq_ids[index]])')
        exec(f'thread{index}.start()')
