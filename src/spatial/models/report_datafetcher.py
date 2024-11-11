import requests
import openai
from transformers import AutoModelForCausalLM, AutoTokenizer
from huggingface_hub import login
from configure import Config
import google.generativeai as genai 


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
    def fetch_air_quality_data_a(grid_id, start_time, end_time):
        token = Config.AIRQO_API_TOKEN  
        if token is None:
            print("Error: AIRQO_API_TOKEN environment variable is not set.")
            return None

        url = f"https://platform.airqo.net/api/v2/analytics/grid/report?token={token}"
        payload = {"grid_id": grid_id, "start_time": start_time, "end_time": end_time}

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err}")
        except requests.exceptions.RequestException as req_err:
            print(f"Request error occurred: {req_err}")
        except ValueError as json_err:
            print(f"JSON decoding error: {json_err}")

        return None

class AirQualityReport:  
    def __init__(self, data): 
        self.data = data
        self.grid_name = data.get('airquality', {}).get('sites', {}).get('grid name', [None])
        self.annual_data = data.get('airquality', {}).get('annual_pm', [None])[0]
        self.daily_mean_data = data.get('airquality', {}).get('daily_mean_pm', [])
        self.diurnal = data.get('airquality', {}).get('diurnal', [])
        self.monthly_data = data.get('airquality', {}).get('site_monthly_mean_pm', [])
        main_site_info = self.monthly_data[0] if self.monthly_data else {}
        self.main_site = main_site_info.get('site_name')
        self.site_names = [item.get('site_name', None) for item in self.data.get('airquality', {}).get('site_annual_mean_pm', [])]
        self.site_latitude = main_site_info.get('site_latitude')
        self.site_longitude = main_site_info.get('site_longitude')
        self.num_sites = data.get('airquality', {}).get('sites', {}).get('number_of_sites') 
        self.starttime = data.get('airquality', {}).get('period', {}).get('startTime', '')[:10]
        self.endtime = data.get('airquality', {}).get('period', {}).get('endTime', '')[:10] 

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
                f"{audience}"
                
                f"Generate a comprehensive air quality assessment report for {self.grid_name} for the period of {self.starttime} to {self.endtime}. Begin with a detailed introduction (100-130 words) covering the city's geographical location, climate characteristics, population density, and major pollution sources. "
                f"{base_info} include the period under review."
                f"Daily mean measurements show: {self.daily_mean_data}. "
                f"Diurnal patterns indicate: {self.diurnal}. Monthly trends reveal: {self.monthly_data}. "
                f"Provide a thorough analysis of spatial and temporal air quality variations, identify pollution hotspots and clean zones, examine seasonal patterns, and assess compliance with WHO guidelines. "
                f"Conclude with actionable recommendations for air quality improvement and public health protection. Data source: AirQo monitoring network."
            )
        elif audience == "policymaker":
            return (
                f"{audience}"
                f"Create an executive summary of air quality conditions in {self.grid_name} for the period of {self.starttime} to {self.endtime}. for policy decision-making. Begin with key findings and their policy implications (50-75 words). "
                f"{base_info} include the period under review."
                f"Highlight critical trends: {self.monthly_data}. Diurnal patterns indicate: {self.diurnal}. "
                f"Focus on: 1) Areas exceeding air quality standards, 2) Population exposure risk assessment, "
                f"3) Economic implications of poor air quality. Present clear, actionable policy recommendations with expected outcomes and implementation timeframes. "
                f"Include cost-benefit considerations and potential regulatory measures. Data source: AirQo monitoring network."
            )
        elif audience == "general public":
            return (
                f"{audience}"
                f"{base_info} include the period under review."
                f"Create a clear, easy-to-understand report about air quality in {self.grid_name} for the period of {self.starttime} to {self.endtime}. Start with a simple explanation of why air quality matters for public health. "
                f"We have {self.num_sites} air quality monitors in your area. The average PM2.5 level this year is {self.annual_data} µg/m³. "
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
        response = self.gemini_model.generate_content(prompt)
        gemini_output = response.text
        return self._prepare_report_json(gemini_output)

    def generate_report_with_openai(self, audience):
        prompt = self._generate_prompt(audience)
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        openai_output = response.choices[0].message['content']
        return self._prepare_report_json(openai_output)

    # Use non-LLM template text as report content
    def generate_report_template_witout_LLM(self, audience):
        prompt = self._generate_prompt(audience)
        report_content = prompt
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
