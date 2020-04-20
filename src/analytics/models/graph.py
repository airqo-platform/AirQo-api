import app 
from helpers import mongo_helpers, helpers
from datetime import datetime,timedelta
import pandas as pd

class Graph():
    """
    The class handles functionality for accessing data for the graphs (charts).

    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.

    """

    def __init__(self):
        """ initialize """ 
                
    def resample_timeseries_data(self, data, frequency, datetime_field, decimal_places):
        """
        Resamples the time series data provided into the specified frequency
        
        Args:
            chart_data (list): list of objects containing the timeseries data e.g [{'pollutant_value': 21.88, 'time': '2020-04-10T03:00:00+0300'}]
            frequency  (str): string specifying the frequency for the resampling i.e. 'M', "H", "D".
            datetime_field (str): The field to be used as a time index for the resampling.
            decimal_places (int): Specifes the number of decimal places to which values should be rounded to.
            
        Returns:
            A list containing the resampled timeseries.
        """
        if not data:
            return []
        else:
            df = pd.DataFrame(data)
            df[datetime_field] = pd.to_datetime(df[datetime_field])
            time_indexed_data = df.set_index(datetime_field)
            resampled_average_concentrations  = time_indexed_data.resample(frequency).mean().round(decimal_places)        
            resampled_timeseries = [{'pollutant_value':row.pollutant_value,
                'time':datetime.strftime(index,'%Y-%m-%dT%H:%M:%S%z')}
                for index, row in resampled_average_concentrations.iterrows() ] 
            return resampled_timeseries



    def get_filtered_data(self, device_code, start_date = None, end_date=None, frequency = 'daily', pollutant = 'PM 2.5'):
        """
        Gets all the data for the specified pollutant from the device with the specified code observed between
        the specified start date and end date for the specified time frequency.

        Args:
            device_code (str): the code used to identify a device.
            start_date (datetime): the datetime from which observations to be returned should start(lower boundary). 
            end_date (datetime): the datetime from which observations to be returned should end(upper boundary).
            frequency (str): the frequency of the observataions i.e. hourly, daily, monthly.
            pollutant (str): the pollutant whose observatations are to be returned i.e. PM 2.5, PM 10, NO2.
        Returns:
            A list of the data(pollutant values & their corresponding time) for the specified pollutant from the device with the specified code observed between
        the specified start date and end date for the specified time frequency.
            
        """
        if start_date == None:
            start = helpers.str_to_date_find('2019-06-01T00:00:00Z')
        else:
            start = helpers.str_to_date(start_date)
        if end_date == None:
            end = datetime.now()
        else:
            end = helpers.str_to_date(end_date)

        query = {'$match':{ 'deviceCode': device_code, 'time': {'$lte': end, '$gte': start} }}
                                 
        if pollutant == 'PM 10':            
            projection = { '$project': { '_id': 0, 
            'time': {'$dateToString':{ 'format': '%Y-%m-%dT%H:%M:%S%z', 'date': '$time', 'timezone':'Africa/Kampala'}}, 
                'pollutant_value': {'$round':['$characteristics.pm10ConcMass.value',2]} }}
        elif pollutant == 'NO2':           
            projection = { '$project': { '_id': 0, 
            'time': {'$dateToString':{ 'format': '%Y-%m-%dT%H:%M:%S%z', 'date': '$time', 'timezone':'Africa/Kampala'}}, 
                'pollutant_value': {'$round':['$characteristics.no2Conc.value',2]} }}       
        else:            
            projection = { '$project': { '_id': 0, 
            'time': {'$dateToString':{ 'format': '%Y-%m-%dT%H:%M:%S%z', 'date': '$time', 'timezone':'Africa/Kampala'}}, 
                'pollutant_value': {'$round':['$characteristics.pm2_5ConcMass.value',2]} }} 
                                
                                         
        if frequency =='hourly':
            records = app.mongo.db.device_hourly_measurements.aggregate([query, projection])            
        elif frequency == 'monthly':
            results = list(app.mongo.db.device_daily_measurements.aggregate([query, projection]))
            records = self.resample_timeseries_data(results, 'M', 'time', 2)
        else:
            records = app.mongo.db.device_daily_measurements.aggregate([query, projection])

    
        return list(records)


        

        

        
