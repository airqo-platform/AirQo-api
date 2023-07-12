import os
import pandas as pd
from dotenv import load_dotenv
from keras.layers import LSTM, Dense
from keras.models import Sequential
from sklearn.preprocessing import MinMaxScaler
from utils import upload_trained_model_to_gcs, connect_mongo
from config import configuration

load_dotenv()
db = connect_mongo()

def lstm_model(dataset):
    dataset.fillna(-9999, inplace=True)
    X = dataset[["s1_pm2.5", "s2_pm2.5"]].values
    y = dataset[
        [
            "offset_fault",
            "out_of_bounds_fault",
            "data_loss_fault",
            "high_variance_fault",
        ]
    ].values
    scaler = MinMaxScaler()
    X = scaler.fit_transform(X)
    model = Sequential()
    model.add(LSTM(85, input_shape=(2, 1)))
    model.add(Dense(4, activation="sigmoid"))
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics="accuracy")
    model.fit(X, y, epochs=5, batch_size=128)

    upload_trained_model_to_gcs(model, scaler, configuration.GOOGLE_CLOUD_PROJECT_ID,
                                configuration.AIRQO_FAULT_DETECTION_BUCKET, "lstm_model.keras")
    return model


if __name__ == "__main__":
    collection = db['fault_data']
    doc = collection.find_one({'readings':{'$exists': True}})
    readings = doc['readings']
    train_df = pd.DataFrame(readings)
    lstm_class = lstm_model(train_df)
