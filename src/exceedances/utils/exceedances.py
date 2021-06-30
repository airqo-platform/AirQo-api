from datetime import datetime, timedelta
import pandas as pd
import requests
import requests
import urllib3
from dataclasses import dataclass
from config import configuration
import numpy as np
from models import Event, Site, Exceedance

# disable tls/ssl warnings
urllib3.disable_warnings()


@dataclass
class Exceedances:
    standard: str


class CalculateExceedances:

    def __init__(self, tenant):
        self.tenant = tenant
        self.WHO_LIMIT = {"pm2_5": 25, "pm10": 50, "no2": 40}
        self.events = self.get_events()
        self.PM_25_AQI_LIMIT = {
            'Good': [0, 12],
            'Moderate': [12, 35.4],
            'UHFSG': [35.4, 55.4],
            'Unhealthy': [55.4, 150.4],
            'VeryUnhealthy': [150.4, 250.4],
            'Hazardous': [250.4, 500.4],
            'All': [0, 2000],
        }
        self.PM_10_AQI_LIMIT = {
            'Good': [0, 54],
            'Moderate': [54, 154],
            'UHFSG': [154, 254],
            'Unhealthy': [254, 354],
            'VeryUnhealthy': [354, 424],
            'Hazardous': [424, 604],
            'All': [0, 2000],
        }
        self.NO2_AQI_LIMIT = {
            'Good': [0, 53],
            'Moderate': [53, 100],
            'UHFSG': [100, 360],
            'Unhealthy': [360, 649],
            'VeryUnhealthy': [649, 1249],
            'Hazardous': [1249, 2049],
            'All': [0, 2049],
        }

    def calculate_exceedances(self):
        """
        get the measurements for all sites accordingly
        Using a loop, calculate each Site's exceedance accordingly
        return the exceedance list for all sites accordingly
        """
        self.get_events()
        aqi = self.get_AQ1()
        who = self.get_WHO()

        # aqi= {
        #          "pm2_5":{pm2_5},
        #          "pm10":{p}m10},
        #          "no2": {no2}
        #         }

        return [
            {
                "site_id": "",
                "time": "",
                "who": {
                    "pm2_5": "",
                    "pm10": "",
                    "no2": ""
                },
                "aqi": {
                    "pm2_5": {
                        "unhealthy": "",
                        "v_healthy": "",
                        "hazardous": "",
                        "UHFSG": ""
                    },
                    "pm10": {
                        "unhealthy": "",
                        "v_healthy": "",
                        "hazardous": "",
                        "UHFSG": ""
                    },
                    "no2": {
                        "unhealthy": "",
                        "v_healthy": "",
                        "hazardous": "",
                        "UHFSG": ""
                    }
                },
            },
            {},
            {}]

    def save_exceedances(self, exceedances):
        """
        Get the exceedance array/list that needs to be stored
        And then save it into the database accordingly
        """

    def calculate_AQ1_pm2_5(self, element):
        """
        UH4SG_pm2_5_count = 0
        Unhealthy_pm2_5_count = 0
        VeryUnhealthy_pm2_5_count = 0
        Hazardous_pm2_5_count = 0,

        UH4SG_pm10_count = 0
        Unhealthy_pm10_count = 0
        VeryUnhealthy_pm10_count = 0
        Hazardous_pm10_count = 0,

        UH4SG_no2_count = 0
        Unhealthy_no2_count = 0
        VeryUnhealthy_no2_count = 0
        Hazardous_no2_count = 0,

            if (self.PM_25_AQI_LIMIT.UHFSG.includes(element.value.pm2_5)){
                UH4SG_pm2_5_count +=1
            }

            if (self.PM_25_AQI_LIMIT.Unhealthy.includes(element.value.pm2_5)){
                 Unhealthy_pm2_5_count +=1
            }

             if (self.PM_25_AQI_LIMIT.Unhealthy.includes(element.value.pm2_5){
                 Unhealthy_pm2_5_count +=1
            }

            if (self.PM_25_AQI_LIMIT.VeryUnhealthy.includes(element.value.pm2_5)){
                VeryUnhealthy_pm2_5_count +=1
            }

            if (self.PM_25_AQI_LIMIT.Hazardous.includes(element.value.pm2_5)){
                Hazardous_pm2_5_count +=1
            }

            return {
                        UH4SG: UH4SG_pm2_5_count
                        Unhealthy: Unhealthy_pm2_5_count
                        VeryUnhealthy: VeryUnhealthy_pm2_5_count
                        Hazardous: Hazardous_pm2_5_count,
                   }
        """

    def calculate_AQI_pm10(self, measurements):
        """
        if (self.PM10_AQI_LIMIT.UHFSG.includes(element.value.pm10)){
         UH4SG_pm10_count += 1
        }

        if (self.PM10_AQI_LIMIT.Unhealthy.includes(element.value.pm10)){
             Unhealthy_pm10_count += 1
        }

         if (self.PM10_AQI_LIMIT.Unhealthy.includes(element.value.pm10){
             Unhealthy_pm10_count += 1
        }

        if (self.PM10_AQI_LIMIT.VeryUnhealthy.includes(element.value.pm10)){
            VeryUnhealthy_pm10_count += 1
        }

        if (self.PM10_AQI_LIMIT.Hazardous.includes(element.value.pm10)){
            Hazardous_pm10_count += 1
        }
        return  {
                        UH4SG: UH4SG_pm10_count = 0
                        Unhealthy: Unhealthy_pm10_count = 0
                        VeryUnhealthy: VeryUnhealthy_pm10_count = 0
                        Hazardous: Hazardous_pm10_count = 0,
                    }
        """

    def calculate_AQ1_no2(self, measurements):
        """
         if (self.NO2_AQI_LIMIT.UHFSG.includes(element.value.no2)){
                UH4SG_no2_count +=1
            }

            if ((self.NO2_AQI_LIMIT.Unhealthy.includes(element.value.no2)){
                 Unhealthy_no2_count +=1
            }

             if (self.NO2_AQI_LIMIT.Unhealthy.includes(element.value.no2){
                 Unhealthy_no2_count +=1
            }

            if (self.NO2_AQI_LIMIT.VeryUnhealthy.includes(element.value.no2){
                VeryUnhealthy_no2_count +=1
            }

            if (self.NO2_AQI_LIMIT.Hazardous.includes(element.value.no2)){
                Hazardous_no2_count +=1
            }

            return {
                         UH4SG: UH4SG_no2_count = 0
                         Unhealthy: Unhealthy_no2_count = 0
                         VeryUnhealthy: VeryUnhealthy_no2_count = 0
                         Hazardous: Hazardous_no2_count = 0,
                    }
        """

    def calculate_AQ1(self, measurements, pollutant):
        """
        return the exceedance for all pollutants using the
        AQI metric

        site_measurements = measurements

        get the AQI counts for for the provided sites

        if (pollutant == 2_5){
        pm2_5= calculate_AQ1_pm2_5(measurements)
        }

        if (pollutant == 10){
         pm10 = calculate_AQI_pm10(measurements)
        }

        if (pollutant == no2){
         no2= calculate_AQI_no2(measurements)
        }


         return {
                 "pm2_5":{pm2_5},
                 "pm10":{p}m10},
                 "no2": {no2}
                }

"""

    def calculate_WHO(self):
        """




        """

    def get_events(self):
        api_url = f'{configuration.DAILY_EVENTS_URL}?tenant={self.tenant}'
        events = requests.get(api_url, verify=False)
        if events.status_code != 200:
            return {}

        return events.json()

    def get_sites(self):
        site_model = Site(self.tenant)
        sites = site_model.get_sites()
