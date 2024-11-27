import requests
import openai
from transformers import AutoModelForCausalLM, AutoTokenizer
from huggingface_hub import login
from configure import Config
import google.generativeai as genai 
import logging
from functools import lru_cache


# Configure API keys
GOOGLE_API_KEY = Config.GOOGLE_API_KEY
genai.configure(api_key=GOOGLE_API_KEY)
hf_token = Config.HUGGING_FACE_TOKEN


if hf_token:
    login(hf_token)
else:
    print("Hugging Face token is missing. Set the 'HUGGING_FACE_TOKEN' environment variable.")

class DataFetcher:
    @staticmethod
    @lru_cache(maxsize=128)  # Cache up to 128 most recent queries
    def fetch_air_quality_data_a(grid_id, start_time, end_time):
        token = Config.AIRQO_API_TOKEN  
        analytics_url = Config.ANALTICS_URL
        if token is None:
            print("Error: AIRQO_API_TOKEN environment variable is not set.")
            return None

        url= f"{analytics_url}?token={token}"
        payload = {"grid_id": grid_id, "start_time": start_time, "end_time": end_time}

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err}")
            logging.error(f"HTTP error occurred: {http_err}")
        except requests.exceptions.RequestException as req_err:
            print(f"Request error occurred: {req_err}")
            logging.error(f"Request error occurred: {req_err}")
        except ValueError as json_err:
            print(f"JSON decoding error: {json_err}")
            logging.error(f"JSON decoding error: {json_err}")

        return None

class AirQualityReport:  
    def __init__(self, data): 
        self.data = data
        self.grid_name = data.get('airquality', {}).get('sites', {}).get('grid name', [None])
        self.annual_data = data.get('airquality', {}).get('annual_pm', [None])[0]
        self.daily_mean_data = data.get('airquality', {}).get('daily_mean_pm', [])
        self.diurnal = data.get('airquality', {}).get('diurnal', [])
        self.monthly_data = data.get('airquality', {}).get('site_monthly_mean_pm', [])
        self.monthly_name_data = data.get('airquality', {}).get('pm_by_month_name', [])
        self.site_annual_mean_pm = data.get('airquality', {}).get('site_annual_mean_pm', [])
        self.site_mean_pm = data.get('airquality', {}).get('site_mean_pm', [])
        main_site_info = self.monthly_data[0] if self.monthly_data else {}
        self.main_site = main_site_info.get('site_name')
        self.site_names = [item.get('site_name', None) for item in self.data.get('airquality', {}).get('site_annual_mean_pm', [])]
        self.site_latitude = main_site_info.get('site_latitude')
        self.site_longitude = main_site_info.get('site_longitude')
        self.num_sites = data.get('airquality', {}).get('sites', {}).get('number_of_sites') 
        self.starttime = data.get('airquality', {}).get('period', {}).get('startTime', '')[:10]
        self.endtime = data.get('airquality', {}).get('period', {}).get('endTime', '')[:10] 

        self.annual_pm2_5_calibrated_value = self.annual_data.get("pm2_5_calibrated_value")
        self.annual_pm10_calibrated_value = self.annual_data.get("pm10_calibrated_value")

        # Finding the minimum and maximum values
        if self.daily_mean_data:
            filtered_data = [
                    item for item in self.daily_mean_data 
                    if 'pm2_5_calibrated_value' in item and isinstance(item['pm2_5_calibrated_value'], (int, float))
                ]
            if filtered_data:
                self.daily_min_pm2_5 = min(filtered_data, key=lambda x: x['pm2_5_calibrated_value'])
                self.daily_max_pm2_5 = max(filtered_data, key=lambda x: x['pm2_5_calibrated_value'])
            else:
                self.daily_min_pm2_5 = None
                self.daily_max_pm2_5 = None
        else:
            self.daily_min_pm2_5 = None
            self.daily_max_pm2_5 = None
        

        # Initialize models once in the constructor
        self.gemini_model = genai.GenerativeModel('gemini-pro')
        openai.api_key = Config.OPENAI_API_KEY

    def _prepare_base_info(self):
        return (
            
            f"The air quality report is for {self.grid_name} for the period of {self.starttime} to {self.endtime}. "
            f"These air quality monitoring sites are {self.site_names} and measure PM2.5 and PM10, "
            f"at coordinates {self.site_latitude}°N, {self.site_longitude}°E. "
            f"The annual PM2.5 concentration averages {self.annual_data} µg/m³."
        )

    def _generate_prompt(self, audience):
        base_info = self._prepare_base_info()
        if audience == "researcher":
            return (   
-                f"Generate a comprehensive air quality assessment report for {self.grid_name} for the period of {self.starttime} to {self.endtime}. Begin with a detailed introduction (100-130 words) covering the city's geographical location, climate characteristics, population density, and major pollution sources. "  
-                f"{base_info} include the period under review."  
-                f"Daily mean measurements show: {self.daily_mean_data}. "  
-                f"Diurnal patterns indicate: {self.diurnal}. Monthly trends reveal: {self.monthly_data}. "  
+                f"Generate a comprehensive air quality assessment report for {self.grid_name} for the period of {self.starttime} to {self.endtime}. Begin with a detailed introduction (100-130 words) covering the city's geographical location, climate characteristics, population density, and major pollution sources.\n"  
+                f"{base_info}\n"  
+                f"Daily mean measurements show values ranging from {self.daily_min_pm2_5['pm2_5_calibrated_value']} to {self.daily_max_pm2_5['pm2_5_calibrated_value']} µg/m³.\n"  
+                f"Diurnal patterns indicate peak pollution levels at {self._format_diurnal_peak()}.\n"  
+                f"Monthly trends reveal fluctuations correlated with seasonal changes.\n"  
                 f"Provide a thorough analysis of spatial and temporal air quality variations, identify pollution hotspots and clean zones, examine seasonal patterns, and assess compliance with WHO guidelines. "  
                 f"Conclude with actionable recommendations for air quality improvement and public health protection. Data source: AirQo monitoring network."  
             ) 

        elif audience == "policymaker":
            return (
                f"Create an executive summary of air quality conditions in {self.grid_name} for the period of {self.starttime} to {self.endtime}. for policy decision-making. Begin with key findings and their policy implications (50-75 words). "
                f"{base_info} include the period under review."
                f"Highlight critical trends: {self.monthly_data}. Diurnal patterns indicate: {self.diurnal}. "
                f"Focus on: 1) Areas exceeding air quality standards, 2) Population exposure risk assessment, "
                f"3) Economic implications of poor air quality. Present clear, actionable policy recommendations with expected outcomes and implementation timeframes. "
                f"Include cost-benefit considerations and potential regulatory measures. Data source: AirQo monitoring network."
            )
        elif audience == "general public":
            return ( 
                f"{base_info} include the period under review."
                f"Create a clear, easy-to-understand report about air quality in {self.grid_name} for the period of {self.starttime} to {self.endtime}. Start with a simple explanation of why air quality matters for public health. "
                f"We have {self.num_sites} air quality monitors in your area. The average PM2.5 level this year is {self.annual_pm2_5_calibrated_value} µg/m³. "
                f"Diurnal patterns indicate: {self.diurnal}. Monthly trends reveal: {self.monthly_data}. "
                f"Explain what these numbers mean for daily activities. Include: 1) When air quality is best and worst during the day, "
                f"2) Which areas have better or worse air quality, 3) Simple steps people can take to protect their health, "
                f"4) How to access daily air quality updates. Use plain language and avoid technical terms. "
                f"Add practical tips for reducing exposure to air pollution. Data source: AirQo monitoring network."
            )
        else:
            raise ValueError("Invalid audience type. Please specify 'researcher', 'policymaker', or 'general public'.")

    def generate_report_with_gemini(self, audience):
        prompt = self._generate_prompt(audience)
        try:
            response = self.gemini_model.generate_content(prompt)
            gemini_output = response.text
            return self._prepare_report_json(gemini_output)
        except Exception as e:
            print(f"Error: {e}")
            return None
    # Generate report with customised prompt
    @lru_cache(maxsize=64)  # Cache up to 64 most recent reports
    def generate_report_with_customised_prompt_gemini(self, custom_prompt):
        """
        Generate an air quality report using a customised user-provided prompt.
        """
        base_info = self._prepare_base_info() 
        full_prompt = (

            f"{base_info} include the period under review."
            f"diurnal patterns indicate: {self.diurnal}. "
            f"number of sites or devices or airqo binos: {self.num_sites}. "
            f"{self.daily_mean_data}"
            f"site mean{self.site_mean_pm}"
            f" daily {self.daily_mean_data}"
            f"{custom_prompt}" 
        )
        try:
            response = self.gemini_model.generate_content(full_prompt)
            gemini_output = response.text
            return self._prepare_customised_report_json(gemini_output)
        except Exception as e:
            print(f"Error: {e}")

    def generate_report_with_openai(self, audience):
        prompt = self._generate_prompt(audience)
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}]
            )
            openai_output = response.choices[0].message['content']
            return self._prepare_report_json(openai_output)
        except Exception as e:
            print(f"Error: {e}")
            return None


    # Use non-LLM template text as report content
    def generate_report_template_without_LLM(self, audience):
        prompt = self._generate_prompt(audience)
        report_content = prompt
        return self._prepare_report_json(report_content)
    
    def generate_report_without_llm(self):
    # Determine peak time and least PM2.5 values
        if self.diurnal:
            peak_data = max(self.diurnal, key=lambda x: x['pm2_5_calibrated_value'])
            peak_time = peak_data['hour']
            peak_pm2_5 = peak_data['pm2_5_calibrated_value']
            least_data = min(self.diurnal, key=lambda x: x['pm2_5_calibrated_value'])
            least_pm2_5 = least_data['pm2_5_calibrated_value']
            least_pm2_5_time = least_data['hour']
        else:
            peak_time = None
            peak_pm2_5 = None
            least_pm2_5 = None
        least_pm2_5_time = None

        
        introduction = (
            f"The air quality report for {self.grid_name} covers the period from {self.starttime} to {self.endtime}. "
            f"The {self.num_sites} monitored sites include: {', '.join(self.site_names)}. "
            f"Measurements are taken for PM2.5 and PM10 concentrations. " 
            f"The annual average PM2.5 concentration is {self.annual_pm2_5_calibrated_value} µg/m³."
        )
        
        diurnal_description = (
            f"Diurnal patterns observed include the following: {self.diurnal}. "
            f"These patterns provide insight into air quality fluctuations throughout the day. "
            f"The peak in PM2.5 {peak_pm2_5} levels occurs around {peak_time}:00 hr, indicating a period of higher pollution, often associated with increased activity or traffic. "
            f"Conversely, the period with the least PM2.5 {least_pm2_5}  µg/m³ levels is around {least_pm2_5_time} :00 hr , "
            f"which usually represents a period of lower activity or better atmospheric dispersion."
            f"Understanding the patterns of pollution and their impacts on public health is crucial for effective environmental management and policy-making. "
            f"Throughout this report, we will explore key trends in PM2.5 and PM10 concentrations, the diurnal variations, and the impact of these levels on air quality across the region."

        )

        daily_mean_description = (
            f"Daily mean PM2.5 measurements during the period were recorded as follows: {self.daily_mean_data}. "
            f"This data reveals variations in air quality on a day-to-day basis."
        )

        site_pm25_description = (
            f"The concentration of PM2.5 across different sites shows variability: "
            f"{', '.join([f'{site} with PM2.5 levels' for site in self.site_names])}. "
            f"These variations indicate site-specific air quality differences for the known grids."
        )
        conclusion = (
            f"Overall, the air quality report highlights the importance of monitoring and understanding the patterns of PM2.5 and PM10 concentrations in the {self.grid_name} "
            f"The analysis of the data reveals that air quality varies significantly over time, with periods of both moderate and unhealthy conditions. "
            f"It’s observed that these fluctuations may be influenced by various factors, including seasonal changes. For instance, the washout effect during the rainy"
            f" season could potentially contribute to these variations. Specifically, for the period from   {self.starttime} to {self.endtime},"
            f" the PM2.5 raw values ranged from {self.daily_min_pm2_5['pm2_5_raw_value']} µg/m³ on {self.daily_min_pm2_5['date']} to {self.daily_max_pm2_5['pm2_5_raw_value']} µg/m³ on {self.daily_max_pm2_5['date']}. respectively."
            f"This pattern underscores the importance of continuous monitoring and the implementation of"
            f"effective interventions to maintain air quality within safe limits. Ensuring good air quality is crucial for "
            f"the well-being of both residents and visitors. Therefore, it’s imperative to adopt long-term"
            f"strategies and measures that can effectively mitigate the impact of factors leading to poor airquality."
            f"In conclusion, continuous monitoring, timely intervention, and effective policies are key to maintaining good air quality and safeguarding public health. "
        )

        report_content = (
            f"{introduction}\n\n"
            f"{diurnal_description}\n\n"
            f"{daily_mean_description}\n\n"
            f"{site_pm25_description}\n\n"
            f"{conclusion}"
        )


        return self._prepare_report_json(report_content)

    def _prepare_report_json(self, report_content):
        return {
            "grid_name": self.grid_name,
            "main_site": self.main_site, 
            "annual_data": self.annual_data,
            "daily_mean_data": self.daily_mean_data,
            "diurnal": self.diurnal,
            "monthly_data": self.monthly_data,
            "report": report_content
        }
    
    def _prepare_customised_report_json(self, report_content):
        return {
            "grid_name": self.grid_name,
            "start_end_time": self.starttime + " to " + self.endtime,
            "report": report_content
        }