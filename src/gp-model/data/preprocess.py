import numpy as np
import pandas as pd

pd.set_option("mode.chained_assignment", None)


def data_to_df(data):

    return pd.DataFrame(data)


def drop_missing_value(df):
    df["time"] = pd.to_datetime(df["time"])
    df = df.drop_duplicates()
    drop_missing_df = df.dropna(axis=0)
    drop_missing_df = drop_missing_df.sort_values(by="time")
    return drop_missing_df.reset_index(drop=True)


def getFeatures(df: pd.core.frame.DataFrame) -> pd.core.frame.DataFrame:
    df = df.set_index(["time"]).ffill()
    df = df.assign(
        hour=df.index.hour,
        day=df.index.day,
        month=df.index.month,
        day_of_week=df.index.dayofweek,
        # week_of_year=df.index.isocalendar().week
    )
    return df


def get_location_cord(df: pd.core.frame.DataFrame) -> pd.core.frame.DataFrame:

    df["x_cord"] = np.cos(df["latitude"]) * np.cos(df["longitude"])
    df["y_cord"] = np.cos(df["latitude"]) * np.sin(df["longitude"])
    df["z_cord"] = np.sin(df["latitude"])
    return df.drop(["latitude", "longitude"], axis=1)


def generate_cyclical_features(
    df: pd.core.frame.DataFrame, col_name: list
) -> pd.core.frame.DataFrame:

    for time_col in col_name:
        kwargs = {
            f"sin_{time_col}": lambda x: np.sin(
                2 * np.pi * (x[time_col] - x[time_col].min()) / x[time_col].nunique()
            ),
            f"cos_{time_col}": lambda x: np.cos(
                2 * np.pi * (x[time_col] - x[time_col].min()) / x[time_col].nunique()
            ),
        }
        df_time = df.assign(**kwargs)[["sin_" + time_col, "cos_" + time_col]]

        df = pd.concat([df, df_time], axis=1)
    return df


def oneHotEncoding(
    df: pd.core.frame.DataFrame, col_name: list
) -> pd.core.frame.DataFrame:

    return pd.get_dummies(data=df, columns=col_name, drop_first=True)


def preprocess(df, col_list=["hour", "day", "month", "day_of_week"]):
    df = drop_missing_value(df)
    df = getFeatures(df)
    df = get_location_cord(df)
    df = generate_cyclical_features(df, col_list)
    # df_output = oneHotEncoding(df_feat_refine, col_list)

    return df
