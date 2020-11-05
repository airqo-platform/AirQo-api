import json
import requests
from google.cloud import storage
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import os
credentials = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

storage_client = storage.Client(credentials)

def get_channels():
    '''
    Gets details of channels whose data is to be used in training
    '''
    blob = storage_client.get_bucket('api-keys-bucket') \
        .get_blob('kampala-api-keys.json') \
        .download_as_string()
    return json.loads(blob)

def download_seven_days(channel_id, api_key):
    '''
    Downloads data from ThingSpeak for a specific channel for the past week
    '''
    channel_data = []
    result = 8000
    end_time = datetime.utcnow()
    start_time = end_time-timedelta(days=7)
    start = datetime.strftime(start_time, '%Y-%m-%dT%H:%M:%SZ')
    end = datetime.strftime(end_time, '%Y-%m-%dT%H:%M:%SZ')
    base_url = f'https://api.thingspeak.com/channels/{channel_id}/feeds.json'
    
    while (end_time > start_time) and (result==8000):
        channel_url = base_url+'?start='+start+'&end='+end
        print(channel_url)
        data = json.loads(requests.get(channel_url, timeout = 100.0).content.decode('utf-8'))
        if (data!=-1 and len(data['feeds'])>0):
            channel_data.extend(data['feeds'])
            end = data['feeds'][0]['created_at']
            result = len(data['feeds'])
            print(result)
            end_time = datetime.strptime(end, '%Y-%m-%dT%H:%M:%SZ') - timedelta(seconds=1)
        else:
            return pd.DataFrame()
    return pd.DataFrame(channel_data)

def preprocessing(df):
    '''
    Preprocesses data for a particular channel
    '''
    df = df.drop_duplicates()
    df['field1'].fillna(df['field3'], inplace=True)
    df = df[['created_at','field1']]
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['field1'] = pd.to_numeric(df['field1'], errors='coerce')
    df = df.sort_values(by='created_at',ascending=False)

    return df

def objective_closure(m):
    return - m.log_marginal_likelihood()

def train_model(X, Y):
    '''
    Creates a model, trains it using given data and saves it for future use
    '''
    Yset = Y
    Yset[Yset==0] = np.nan
    
    keep = ~np.isnan(Yset[:,0]) 
    Yset = Yset[keep,:]
    Xset = X[keep,:]
    
    Xtraining = Xset[::10,:]
    Ytraining = Yset[::10,:]
    
    k = gpflow.kernels.RBF(lengthscales=[0.08, 0.08, 1.5]) + gpflow.kernels.Bias()
    m = gpflow.models.GPR(data=(Xtraining, Ytraining), kernel=k, mean_function=None)
    set_trainable(m.kernel.kernels[0].lengthscales, True) 
    
    opt = gpflow.optimizers.Scipy()
    opt_logs = opt.minimize(objective_closure(m),
                        m.trainable_variables,
                        options=dict(maxiter=100))
    return m


def save_model(m):
    '''
    Saves the model to a folder
    '''
    frozen_model = gpflow.utilities.freeze(m)
    module_to_save = tf.Module()
    predict_fn = tf.function(frozen_model.predict_f, input_signature=[tf.TensorSpec(shape=[None, 3], dtype=tf.float64)])
    module_to_save.predict = predict_fn
    save_dir = 'saved_model'
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    tf.saved_model.save(module_to_save, save_dir)
    
def upload_model():
    '''
    Uploads saved model to bucket on GCP
    '''
    bucket_name = 'airqo-models-bucket'
    source_folder = 'saved_model'
    destination_folder = 'gp_model'
    bucket = storage_client.bucket(bucket_name)
    
    for file in glob.glob(source_folder + '/**'):
        if os.path.isfile(file):
            remote_path = os.path.join(destination_folder, file[1 + len(source_folder):])
            remote_path = remote_path.replace('\\','/')
            blob = bucket.blob(remote_path)
            blob.upload_from_filename(file)
        elif len(os.listdir(file)) == 0: 
            blob = bucket.blob(destination_folder+'/'+os.path.basename(file)+'/')
            blob.upload_from_string('', content_type='application/x-www-form-urlencoded;charset=UTF-8')
        else:
            dir_name = destination_folder+'/'+os.path.basename(file)+'/'
            blob = bucket.blob(dir_name)
            blob.upload_from_string('', content_type='application/x-www-form-urlencoded;charset=UTF-8')
            upload_files(bucket_name, file.replace('\\','/'), dir_name) 

def periodic_function():
    '''
    Re-trains the model regularly
    '''
    X = np.zeros([0,3])
    Y = np.zeros([0,1])
    channels = get_channels()
    for channel in channels:
        d = download_seven_days(channel['id'], channel['api_key'])
        if d.shape[0]!=0:
            d = preprocessing(d)
            df = pd.DataFrame({'channel_id':[channel['id']], 
                               'longitude':[channel['long']], 
                               'latitude':[channel['lat']]})
        
            Xchan = np.c_[np.repeat(np.array(df)[:,1:],d.shape[0],0),[n.timestamp()/3600 for n in d['created_at']]]
            Ychan = np.array(d['field1'])
            X = np.r_[X,Xchan]
            Y = np.r_[Y,Ychan[:, None]]
    m = train_model(X, Y)
    save_model(m)
    upload_model()