from google.oauth2 import service_account
from config import configuration
import gcsfs


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    # print('fetching data from bigquery')
    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    query = f"""
    SELECT DISTINCT timestamp, device_number, s1_pm2_5, s2_pm2_5 FROM {configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 HOUR) and tenant = 'airqo'
      ORDER
      BY
      timestamp
      """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['device_number'] = df['device_number'].astype(str)
    df = df.groupby(['device_number', pd.Grouper(key='timestamp', freq='H')]).mean(numeric_only=True)
    df = df.reset_index()
    df.sort_values(by=['device_number', 'timestamp'], inplace=True)
    df['device_number'] = df['device_number'].astype(int)
    print('data fetched from bigquery')
    return df


def scale_data(df, scaler):
    """
    scales data using MinMaxScaler
    """
    inputs = df.iloc[:, : 3].values
    additional_features = df.iloc[:, 3:].values

    # transform the inputs using the scaler
    scaled_inputs = scaler.transform(inputs)

    # concatenate the scaled inputs and additional features
    scaled_inputs = np.concatenate((scaled_inputs, additional_features), axis=1)

    print("Data scaled")

    return scaled_inputs


def preprocess_data(df):
    df1 = get_other_features(df)
    df1.drop('index', axis=1, inplace=True)
    return df1


def get_other_features(df):
    """
    adds datetime features such as hour, minute, second dato the dataframe
    """
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute', 'second']
    for a in attributes:
        df[a] = df['timestamp'].dt.__getattribute__(a)

    df['week'] = df['timestamp'].dt.isocalendar().week
    df.drop('timestamp', axis=1, inplace=True)
    print("TimeStamp features added")
    return df


def load_trained_model_and_scaler_from_gcs(project_name, bucket_name, source_blob_name, scaler_blob_name):
    # create a GCSFileSystem object
    fs = gcsfs.GCSFileSystem(project=project_name)

    # load the model from GCS bucket
    with fs.open(bucket_name + '/' + source_blob_name, 'rb') as model_handle:
        model = load_model(model_handle)

        print("Model loaded from GCS bucket")

        # load the scaler from GCS bucket
    with fs.open(bucket_name + '/' + scaler_blob_name, 'rb') as scaler_handle:
        scaler = joblib.load(scaler_handle)

        print("Scaler loaded from GCS bucket")

    return model, scaler


def create_dataset(X, time_steps=1):
    Xs = []
    for i in range(len(X) - time_steps):
        v = X[i:(i + time_steps), :]
        Xs.append(v)
    print("Dataset created")
    return np.array(Xs)


if __name__ == '__main__':
    model = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.BUCKET_NAME,
                                       'lstm_model.h5')
    device_data = fetch_bigquery_data()
    original_data = device_data.copy()
    new_data = preprocess_data(original_data)
    model, scaler = load_trained_model_and_scaler_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID,
                                                              configuration.BUCKET_NAME, 'lstm_model.h5',)

