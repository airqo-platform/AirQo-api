import pandas as pd
import numpy as np
import matplotlib.dates as mdates
#%matplotlib inline
import os
import datetime
from sklearn.linear_model import LinearRegression  
from sklearn.model_selection import train_test_split 
from sklearn import metrics
#from scipy import stats
import scipy.stats
import joblib
from scipy.optimize import curve_fit
import uncertainties.unumpy as unp
import uncertainties as unc


muk_lowcost_data = pd.read_csv("jobs\AQ_88.csv") #channel 88-thingspeak,  device colocated with MUK BAM
muk_bam_data = pd.read_csv('jobs\MUK-BAM.csv')#MUK BAM

def process_data_lowcost(muk_lowcost_data):
    muk_lowcost_data.rename(columns={'field1':'Sensor1 PM2.5_CF_1_ug/m3','field2':'Sensor1 PM10_CF_1_ug/m3',
                                     'field3':'Sensor2PM2.5_CF_1_ug/m3', 'field4':'Sensor2 PM10_CF_1_ug/m3',
                                     'field5': 'Latitude', 'field6':'Longitude', 'field7':'Battery Voltage', 
                                     'field8':'GpsData'},inplace=True)
    muk_lowcost_data = muk_lowcost_data.drop(['entry_id','Latitude', 'Longitude', 'Battery Voltage','GpsData','latitude','longitude', 'elevation','status'], axis=1)
    muk_lowcost_data['Average_PM2.5_CF_1_ug/m3'] = muk_lowcost_data[['Sensor1 PM2.5_CF_1_ug/m3', 'Sensor2PM2.5_CF_1_ug/m3']].mean(axis=1).round(2)
    muk_lowcost_data['Average_PM10_CF_1_ug/m3'] = muk_lowcost_data[['Sensor1 PM10_CF_1_ug/m3', 'Sensor2 PM10_CF_1_ug/m3']].mean(axis=1).round(2)

    muk_lowcost_data["TimeStamp"] = pd.to_datetime(muk_lowcost_data["created_at"])
    muk_lowcost_data.drop_duplicates(subset ="TimeStamp", keep = 'first', inplace = True)
    muk_lowcost_data = muk_lowcost_data.set_index('TimeStamp')
    muk_lowcost_data = muk_lowcost_data.drop(['created_at'], axis=1)

    muk_lowcost_data = muk_lowcost_data[muk_lowcost_data['Average_PM2.5_CF_1_ug/m3'] <= 500.4]
    muk_lowcost_data = muk_lowcost_data[muk_lowcost_data['Average_PM2.5_CF_1_ug/m3'] > 0]

    muk_lowcost_data = muk_lowcost_data.loc['2020-07-16 00:00:00':'2020-07-30 23:59:59']

    muk_lowcost_hourly_mean = muk_lowcost_data.resample('H').mean().round(2)
    
    return muk_lowcost_hourly_mean
muk_lowcost_hourly_mean = process_data_lowcost(muk_lowcost_data)


def process_data_bam(muk_bam_data):
    muk_bam_data = muk_bam_data.drop(['Flow(lpm)', 'WS(m/s)', 'WD(Deg)', 'BP(mmHg)', 'FT(C)', 'FRH(%)', 'Status'], axis=1)
    muk_bam_data["TimeStamp"] = pd.to_datetime(muk_bam_data["Time"])
    muk_bam_data.drop_duplicates(subset ="TimeStamp", keep = 'first', inplace = True)
    muk_bam_data = muk_bam_data.set_index('TimeStamp')
    muk_bam_data = muk_bam_data.drop(['Time'], axis=1)
    
    muk_bam_data = muk_bam_data[muk_bam_data['ConcHR(ug/m3)'] <= 500.4]
    muk_bam_data = muk_bam_data[muk_bam_data['ConcHR(ug/m3)'] > 0]

    return muk_bam_data
muk_bam_data = process_data_bam(muk_bam_data)

def combine_datasets(muk_lowcost_hourly_mean, muk_bam_data):
    ## get the lower boundary date 
    muk_lowcost_hourly_mean.iloc[:1,:]
    t= muk_lowcost_hourly_mean.iloc[:1,:].index.values[0]
    t = t.astype(datetime.datetime)
    z= pd.to_datetime(t)
    muk_lowcost_hourly_mean_lower_date = z.strftime('%Y-%m-%d %H:%M:%S')

    ## get the upper boundary date 
    t = muk_lowcost_hourly_mean.iloc[-1:,:].index.values[0]
    t = t.astype(datetime.datetime)
    z= pd.to_datetime(t)
    muk_lowcost_hourly_mean_upper_date = z.strftime('%Y-%m-%d %H:%M:%S')
    
    ## get the lower boundary date 
    muk_bam_data.iloc[:1,:]
    t= muk_bam_data.iloc[:1,:].index.values[0]
    t = t.astype(datetime.datetime)
    z= pd.to_datetime(t)
    muk_bam_data_lower_date = z.strftime('%Y-%m-%d %H:%M:%S')

    ## get the upper boundary date
    t = muk_bam_data.iloc[-1:,:].index.values[0]
    t = t.astype(datetime.datetime)
    z= pd.to_datetime(t)
    muk_bam_data_upper_date = z.strftime('%Y-%m-%d %H:%M:%S')

    hourly_same_daterange = muk_bam_data[muk_lowcost_hourly_mean_lower_date:muk_lowcost_hourly_mean_upper_date]

    muk_lowcost_hourly_mean  = muk_lowcost_hourly_mean.drop(['Sensor1 PM10_CF_1_ug/m3','Sensor2 PM10_CF_1_ug/m3','Average_PM10_CF_1_ug/m3', ], axis=1)
    hourly_timestamp = muk_lowcost_hourly_mean.index.values
    muk_lowcost_hourly_mean["Time"] = hourly_timestamp
    muk_lowcost_hourly_mean["Time"] = pd.to_datetime(muk_lowcost_hourly_mean["Time"])

    hourly_BAM_data =  hourly_same_daterange
    hourly_timestamp = hourly_BAM_data.index.values
    hourly_BAM_data["Time"] = hourly_timestamp
    hourly_BAM_data["Time"] = pd.to_datetime(hourly_BAM_data["Time"])

    hourly_combined_dataset= pd.merge(muk_lowcost_hourly_mean, hourly_BAM_data, on='Time')
    hourly_combined_dataset.rename(columns={'Average_PM2.5_CF_1_ug/m3':'muk_lowcost_hourly_PM','ConcHR(ug/m3)':'muk_bam_hourly_PM'},inplace=True)
    
    hourly_combined_dataset['muk_bam_hourly_PM'] = hourly_combined_dataset['muk_bam_hourly_PM'].shift(-1)

    return hourly_combined_dataset
hourly_combined_dataset = combine_datasets(muk_lowcost_hourly_mean, muk_bam_data)
hourly_combined_dataset = hourly_combined_dataset[hourly_combined_dataset['muk_lowcost_hourly_PM'].notna()]
hourly_combined_dataset = hourly_combined_dataset[hourly_combined_dataset['muk_bam_hourly_PM'].notna()]

def linear_regression_func(hourly_combined_dataset):
    # take only rows where hourly_PM is not null
        
    X_muk = hourly_combined_dataset['muk_lowcost_hourly_PM'].values
    X_muk = X_muk.reshape((-1, 1))
    y_muk = hourly_combined_dataset['muk_bam_hourly_PM'].values     

    X_train_muk, X_test_muk, y_train_muk, y_test_muk = train_test_split(X_muk, y_muk, test_size=0.2, random_state=0)

    regressor_muk = LinearRegression()  
    regressor_muk.fit(X_train_muk, y_train_muk)  

    intercept =  regressor_muk.intercept_

    slope = regressor_muk.coef_

    return regressor_muk
regressor_muk = linear_regression_func(hourly_combined_dataset)

def intercept(regressor_muk):
    intercept =  regressor_muk.intercept_
    return intercept
intercept = intercept(regressor_muk)
print(intercept)

def slope(regressor_muk):
    slope = regressor_muk.coef_
    return slope
slope = slope(regressor_muk)
print(slope)


# Uncertainity, Standard Deviation and R2
x = hourly_combined_dataset['muk_lowcost_hourly_PM'].values
y = hourly_combined_dataset['muk_bam_hourly_PM'].values

n = len(y)

def f(x, a, b):
    return a * x + b
popt, pcov = curve_fit(f, x, y)

def Uncertainity_std(popt, pcov):
    # retrieve parameter values
    a = popt[0]
    b = popt[1]

    # compute r^2
    r2 = 1.0-(sum((y-f(x,a,b))**2)/((n-1.0)*np.var(y,ddof=1)))

    # calculate parameter confidence interval
    a,b = unc.correlated_values(popt, pcov)

    # calculate regression confidence interval
    px = np.linspace(0, 200, 300)
    py = a*px+b
    nom = unp.nominal_values(py)
    std = unp.std_devs(py)

    return 'R^2: ' + str(r2), 'Uncertainty-Slope: ' + str(a), 'Uncertainty-Intercept: ' + str(b)#, 'Standard Deviation:' + str(std)
performance = Uncertainity_std(popt, pcov)

# def mean_confidence_interval(x, confidence=0.95):
#     '''
#         calculating mean and confidence intervals
#     '''
#     a = 1.0 * np.array(x)
#     n = len(a)
#     m, se = np.mean(a), scipy.stats.sem(a, nan_policy='omit')
#     h = se * scipy.stats.t.ppf((1 + confidence) / 2., n-1)
#     mean = m
#     lower_ci = m-h
#     upper_ci = m+h
#     return mean, lower_ci, upper_ci, h
# ci = mean_confidence_interval(x, confidence=0.95)






