import warnings

import mlflow
import mlflow.sklearn
import pandas as pd
from lightgbm import LGBMRegressor, early_stopping
from sklearn.metrics import mean_squared_error

from config import configuration, environment
from utils import upload_trained_model_to_gcs, fetch_bigquery_data

warnings.filterwarnings("ignore")
mlflow.set_tracking_uri(configuration.MLFLOW_TRACKING_URI)
mlflow.set_experiment(experiment_name=f"hourly_forecast_{environment}")

print(f'mlflow server uri: {mlflow.get_tracking_uri()}')


def preprocess_forecast_data():
    print('preprocess_forecast_data started.....')
    forecast_data = fetch_bigquery_data(job_type='hourly_forecast')
    forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'])
    forecast_data['pm2_5'] = forecast_data.groupby('device_number')['pm2_5'].transform(
        lambda x: x.interpolate(method='linear', limit_direction='both'))
    forecast_data = forecast_data.dropna(subset=['pm2_5'])
    print('preprocess_forecast_data completed.....')
    return forecast_data


def initialise_training_constants():
    target_col = 'pm2_5'

    forecast_data = preprocess_forecast_data()

    model_data = preprocess_df(forecast_data, target_col)
    clf = train_model(model_data)

    upload_trained_model_to_gcs(
        clf,
        configuration.GOOGLE_CLOUD_PROJECT_ID,
        configuration.AIRQO_PREDICT_BUCKET,
        'hourly_forecast_model.pkl')

    print(clf)


def train_model(train):
    """
    Perform the actual training
    """
    print('feature selection started.....')
    # sort values by both device_number and created_at
    train = train.sort_values(by=['device_number', 'created_at'])
    features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
    print(features)
    target_col = "pm2_5"
    train_data, test_data = pd.DataFrame(), pd.DataFrame()

    for device_number in train['device_number'].unique():
        device_df = train[train['device_number'] == device_number]
        device_df = device_df.sort_values(by='created_at')
        months = device_df['created_at'].dt.month.unique()
        train_months = months[:4]
        test_months = months[4:]
        train_df = device_df[device_df['created_at'].dt.month.isin(train_months)]
        test_df = device_df[device_df['created_at'].dt.month.isin(test_months)]
        train_data = pd.concat([train_data, train_df])
        test_data = pd.concat([test_data, test_df])

    train_data['device_number'] = train_data['device_number'].astype(int)
    test_data['device_number'] = test_data['device_number'].astype(int)
    train_data.drop(columns=['created_at'], axis=1, inplace=True)
    test_data.drop(columns=['created_at'], axis=1, inplace=True)

    train_target, test_target = train_data[target_col], test_data[target_col]
    with mlflow.start_run():
        print("Model training started.....")
        n_estimators = 5000
        learning_rate = 0.05
        colsample_bytree = 0.4
        reg_alpha = 0
        reg_lambda = 1
        max_depth = 1
        random_state = 1

        clf = LGBMRegressor(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            colsample_bytree=colsample_bytree,
            reg_alpha=reg_alpha,
            reg_lambda=reg_lambda,
            max_depth=max_depth,
            random_state=random_state)

        clf.fit(train_data[features], train_target, eval_set=[(test_data[features], test_target)],
                callbacks=[early_stopping(stopping_rounds=150)], verbose=50,
                eval_metric='rmse')
        print('Model training completed.....')

        # Log parameters
        mlflow.log_param("n_estimators", n_estimators)
        mlflow.log_param("learning_rate", learning_rate)
        mlflow.log_param("colsample_bytree", colsample_bytree)
        mlflow.log_param("reg_alpha", reg_alpha)
        mlflow.log_param("reg_lamba", reg_lambda)
        mlflow.log_param("max_depth", max_depth)
        mlflow.log_param("random_state", random_state)

        # Log moder
        mlflow.sklearn.log_model(
            sk_model=clf,
            artifact_path="hourly_forecast_model",
            registered_model_name=f"LGBM_hourly_forecast_model_{environment}"
        )

        print("Being model validation.....")

        val_preds = clf.predict(test_data[features])
        rmse_val = mean_squared_error(test_data[target_col], val_preds) ** 0.5

        print("Model validation completed.....")
        print(f'Validation RMSE is {rmse_val}')

        # Log metrics
        mlflow.log_metric("VAL_RMSE", rmse_val)

        best_iter = clf.best_iteration_
        clf = LGBMRegressor(n_estimators=best_iter, learning_rate=0.05, colsample_bytree=0.4, reg_alpha=2, reg_lambda=1,
                            max_depth=-1, random_state=1)
        train['device_number'] = train['device_number'].astype(int)
        clf.fit(train[features], train[target_col])

    return clf


def get_lag_features(df_tmp, TARGET_COL):
    df_tmp = df_tmp.sort_values(by=['created_at', 'device_number'])

    shifts = [1, 2]  # TODO: Review to increase these both in training and the actual job
    for s in shifts:
        df_tmp[f'pm2_5_last_{s}_hour'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(s)

    # lag features
    shifts = [6, 12, 24, 48]
    functions = ['mean', 'std', 'median', 'skew']
    for s in shifts:
        for f in functions:
            df_tmp[f'pm2_5_{f}_{s}_hour'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(1).rolling(s).agg(f)

    return df_tmp


def get_other_features(df_tmp):
    # TODO: Experiment on impact of features
    attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute']

    for a in attributes:
        df_tmp[a] = df_tmp['created_at'].dt.__getattribute__(a)
    df_tmp['week'] = df_tmp['created_at'].dt.isocalendar().week.astype(int)

    print('Additional features added')
    return df_tmp


def preprocess_df(df_tmp, target_column):
    df_tmp = get_other_features(df_tmp)
    df_tmp = get_lag_features(df_tmp, target_column)

    return df_tmp


if __name__ == '__main__':
    initialise_training_constants()
