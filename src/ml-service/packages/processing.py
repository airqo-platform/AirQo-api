import pandas as pd
import numpy as np
# write the funtions for processing
def drop_columns(df, columns):
    df = df.drop(columns, axis = 1)
    return df

def setindex(df):
    df = df.set_index('time')

def change_datatypes(df):
    for col in df.columns:
        if (col is not 'time') & (col is not 'channel_id'):
            df[col] = pd.to_numeric(df[col], errors='coerce')

def clean_coordinates(df):
    #Dealing with Null  values
    df['lat'] = df['lat'].fillna(method = 'bfill') 
    df['long'] = df['long'].fillna(method = 'bfill')

    #coordinates outside Uganda
    outside_indices = df.loc[(df.lat < -1.482074) | (df.lat > 4.221103) |
     (df.long < 29.571283) | (df.long > 35.022797)].index

    df.drop(outside_indices, inplace = True)
    return df
def clean_pm25(df):

    #Filling NaN values for sensor 1 with values from sensor 2
    if 's2_pm2_5' in df.columns:
        df['pm2_5'] = df['pm2_5'].fillna(df['s2_pm2_5'])

    #dropping rows where both sensor values are null
    na_indices = df[(df['pm2_5'].isnull())].index
    df.drop(na_indices, inplace = True)

    #Filling NaN values for sensor 2 with values from sensor 1 and replacing 
    # values outside acceptable range with the other sensor's data
    if 's2_pm2_5' in df.columns:
        df['s2_pm2_5'] = df['s2_pm2_5'].fillna(df['pm2_5'])
        df['pm2_5'] = np.where(((df['pm2_5']<=0) | (df['pm2_5'] >500.4)), df['s2_pm2_5'], df['pm2_5'])
        df['s2_pm2_5'] = np.where(((df['s2_pm2_5']<=0) | (df['s2_pm2_5'] >500.4)), df['pm2_5'], df['s2_pm2_5'])

    
    #Dropping pm2.5 greater than 500.4 or less than or equal to 0 for both sensors
    if 's2_pm2_5' in df.columns:
        outlier_indices = df[((df['pm2_5'] > 500.4) & (df['s2_pm2_5'] > 500.4)) | 
        ((df['pm2_5'] <= 0) & (df['s2_pm2_5'] <=0))].index
    else:
        outlier_indices = df[((df['pm2_5'] > 500.4) | (df['pm2_5'] <= 0))].index

    df.drop(outlier_indices, inplace = True)

    return df
def clean_pm10(df):

   #Filling NaN values for sensor 1 with values from sensor 2
    if 's2_pm10' in df.columns:
        df['pm10'] = df['pm10'].fillna(df['s2_pm10'])

    #dropping rows where both sensor values are null
    na_indices = df[(df['pm10'].isnull())].index
    df.drop(na_indices, inplace = True)

    #Filling NaN values for sensor 2 with values from sensor 1 and replacing 
    # values outside acceptable range with the other sensor's data
    if 's2_pm10' in df.columns:
        df['s2_pm10'] = df['s2_pm10'].fillna(df['pm10'])
        df['pm10'] = np.where(((df['pm10']<=0) | (df['pm10'] >500.4)), df['s2_pm10'], df['pm10'])
        df['s2_pm19'] = np.where(((df['s2_pm10']<=0) | (df['s2_pm10'] >500.4)), df['pm10'], df['s2_pm10'])

    
    #Dropping pm2.5 greater than 500.4 or less than or equal to 0 for both sensors
    if 's2_pm10' in df.columns:
        outlier_indices = df[((df['pm10'] > 500.4) & (df['s2_pm10'] > 500.4)) | 
        ((df['pm10'] <= 0) & (df['s2_pm10'] <=0))].index
    else:
        outlier_indices = df[((df['pm10'] > 500.4) | (df['pm10'] <= 0))].index

    df.drop(outlier_indices, inplace = True)

    return df

def averages(df):
    #Creating columns for differences between sensor 1 and sensor2 values
    if ('s2_pm2_5' in df.columns) & ('s2_pm_10' in df.columns):
        df['diff_pm2_5'] = (df['pm2_5']-df['s2_pm2_5']).abs()
        df['diff_pm10'] = (df['pm10']-df['s2_pm10']).abs()
        diff_indices = df[((df['diff_pm2_5'] > 100) |(df['diff_pm10'] > 200))].index
        df.drop(diff_indices, inplace = True)
    
        df['avg_pm2_5'] = ((df.pm2_5 + df.s2_pm2_5)/2.0)
        df['avg_pm10'] = ((df.pm10 + df.s2_pm10)/2.0)
        df = df.drop(['diff_pm2_5', 'diff_pm10'], axis = 1)
    else:
         df['avg_pm2_5'] = df['pm2_5']
         df['avg_pm10'] = df['pm10']   

    return df
