import requests
import torch 
from transformers import AutoModelForCausalLM, AutoTokenizer
from huggingface_hub import login 
# Initialize gemini
import google.generativeai as genai
from configure import Config
# Configure the API key
GOOGLE_API_KEY = Config.GOOGLE_API_KEY
genai.configure(api_key=GOOGLE_API_KEY)

# Hugging Face Token Login
hf_token = Config.HUGGING_FACE_TOKEN
if hf_token:
    login(hf_token)
else:
    print("Hugging Face token is missing. Set the 'HUGGING_FACE_TOKEN' environment variable.")

class DataFetcher:
    @staticmethod
    def fetch_air_quality_data_a(grid_id, start_time, end_time):
        # Load the API token from the environment variable
        print('STARTS')
        token = Config.AIRQO_API_TOKEN  
        if token is None:
            print("Error: AIRQO_API_TOKEN environment variable is not set.")
            return None
        
        url = f"https://platform.airqo.net/api/v2/analytics/grid/report?token={token}"
        

        # Creating the payload for the request
        payload = {
            "grid_id": grid_id,
            "start_time": start_time,
            "end_time": end_time
        }

        # Log the payload for debugging 
        print(f"Payload: {payload}")

        try:
            # Sending the request
            response = requests.post(url,   json=payload)
        #    print(response)
            # Log response status and content for debugging
            print(f"Response Status Code: {response.status_code}")
        #    print(f"Response Content: {response.text}")

            # Raise an exception if the request was unsuccessful
            response.raise_for_status()

            # Return the response data
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err}")
        except requests.exceptions.RequestException as req_err:
            print(f"Request error occurred: {req_err}")
        except ValueError as json_err:
            print(f"JSON decoding error: {json_err}")

        # Return None if there was an error
        return None

class AirQualityReport:  
    def __init__(self, data, model_name="meta-llama/Llama-3.2-1B", hf_token=None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize tokenizer and model
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, use_auth_token=hf_token)
        self.model = AutoModelForCausalLM.from_pretrained(model_name, use_auth_token=hf_token).to(self.device)

        self.data = data
        self.grid_name = data.get('airquality', {}).get('sites', {}).get('grid_name', [None])[0]
        self.annual_data = data.get('airquality', {}).get('annual_pm', [None])[0]
        self.daily_mean_data = data.get('airquality', {}).get('daily_mean_pm', [])
        self.diurnal = data.get('airquality', {}).get('diurnal', [])
        self.monthly_data = data.get('airquality', {}).get('site_monthly_mean_pm', [])
        main_site_info = self.monthly_data[0] if self.monthly_data else {}
        self.main_site = main_site_info.get('site_name')
        self.site_latitude = main_site_info.get('site_latitude')
        self.site_longitude = main_site_info.get('site_longitude')
        self.num_sites = data.get('airquality', {}).get('sites', {}).get('number_of_sites')

    def generate_llama_report(self):
        prompt = (
            f"Generate a detailed air quality report for {self.grid_name}. The main monitoring site is {self.main_site} located at latitude {self.site_latitude} and longitude {self.site_longitude}. The annual PM2.5 average is {self.annual_data} µg/m³. Here is the daily mean data: {self.daily_mean_data}. The diurnal data shows: {self.diurnal}. Monthly data is as follows: {self.monthly_data}. "
            f"Write the introduction of the city, number of sites and the sites. Discuss the air quality conditions,explain the results including,  the least and high polluted sites, explain  and provide Conclude with insights and recommendations. The data provider is AirQo"
        )

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model.generate(inputs.input_ids, max_length=3350, do_sample=True, temperature=0.7)
        
        llama_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        report_json = {
            "grid_name": self.grid_name,
            "main_site": {
                "name": self.main_site,
                "latitude": self.site_latitude,
                "longitude": self.site_longitude
            },
            "annual_pm": self.annual_data,
            "daily_mean_data": self.daily_mean_data,
            "diurnal_data": self.diurnal,
            "monthly_data": self.monthly_data,
            "report_summary": llama_output
        }
        
        return report_json

    def generate_report_with_gemini(self):
        model = genai.GenerativeModel('gemini-pro')
            # Prepare the prompt for the report
        prompt = (
            f"Generate a comprehensive air quality assessment report for {self.grid_name}. Begin with a detailed introduction (100-130 words) covering the city's geographical location, climate characteristics, population density, and major pollution sources. "
            f"The primary monitoring site is {self.main_site}, situated at coordinates {self.site_latitude}°N, {self.site_longitude}°E. Include analysis of all monitoring sites in the grid. "
            f"The annual PM2.5 concentration averages {self.annual_data} µg/m³. Daily mean measurements show: {self.daily_mean_data}. "
            f"Diurnal patterns indicate: {self.diurnal}. Monthly trends reveal: {self.monthly_data}. "
            f"Provide a thorough analysis of spatial and temporal air quality variations, identify pollution hotspots and clean zones, examine seasonal patterns, and assess compliance with WHO guidelines. "
            f"Conclude with actionable recommendations for air quality improvement and public health protection. Data source: AirQo monitoring network."
        )
    
        # Generate the report
        response = model.generate_content(prompt)
        # Extract the generated text
        gemini_output = response.text 
        # Structure the report in JSON format
        report_json = {
            "grid_name": self.grid_name,
            "main_site": self.main_site, 
            "annual_data": self.annual_data,
            "daily_mean_data": self.daily_mean_data,
            "diurnal": self.diurnal,
            "monthly_data": self.monthly_data,
            "report_summary": gemini_output
        }

        return report_json