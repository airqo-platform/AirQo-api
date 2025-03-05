import requests
import redis
import json
import google.generativeai as genai
import logging
import re
import threading
from flask import Flask
from urllib.parse import urlencode
from configure import Config

# Configure API keys
GOOGLE_API_KEY = Config.GOOGLE_API_KEY
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Flask app
app = Flask(__name__)

# Initialize Redis
# Redis connection

redis_client = redis.StrictRedis(
    host=Config.REDIS_HOST or 'localhost',
    port=Config.REDIS_PORT or 6379,
    db=Config.REDIS_DB or 0,
    password=Config.REDIS_PASSWORD or None,  # Add if password is set
    decode_responses=True
)
class DataFetcher:
    @staticmethod
    def fetch_air_quality_data(grid_id, start_time, end_time):
        """Fetch air quality data, store in Redis to prevent redundant API calls."""
        cache_key = f"air_quality:{grid_id}:{start_time}:{end_time}"
        cached_data = redis_client.get(cache_key)

        if cached_data:
            return json.loads(cached_data)  # Return cached data if available

        token = Config.AIRQO_API_TOKEN
        analytics_url = Config.ANALTICS_URL
        if token is None:
            logging.error("AIRQO_API_TOKEN not set.")
            return None

        query_params = {'token': token}  
        url = f"{analytics_url}?{urlencode(query_params)}"
        payload = {"grid_id": grid_id, "start_time": start_time, "end_time": end_time}
        print("Fetching air quality data: ", payload)
        try:
            response = requests.post(url, json=payload, timeout=5)
            response.raise_for_status()
            data = response.json()

            # Cache response in Redis for 1 hour
            redis_client.setex(cache_key, 3600, json.dumps(data))
            print("Data fetched: ", data)
            return data
            
        except requests.exceptions.HTTPError as http_err:
            logging.error(f"HTTP error: {http_err}")
        except requests.exceptions.RequestException as req_err:
            logging.error(f"Request error: {req_err}")
        except ValueError as json_err:
            logging.error(f"JSON error: {json_err}")
        return None

class AirQualityChatbot:
    def __init__(self, grid_id, start_time, end_time):
        cache_key = f"chatbot_data:{grid_id}:{start_time}:{end_time}"
        cached_data = redis_client.get(cache_key)

        if cached_data:
            data = json.loads(cached_data)  # Load cached chatbot data
        else:
            data = DataFetcher.fetch_air_quality_data(grid_id, start_time, end_time)
            if data:
                redis_client.setex(cache_key, 3600, json.dumps(data))  # Cache for 1 hour

        self.data = data or {}

        # Extract and store key data
        self.grid_name = self.data.get('airquality', {}).get('sites', {}).get('grid name', ['Unknown'])[0]
        self.annual_data = self.data.get('airquality', {}).get('annual_pm', [{}])[0] or {}
        self.daily_mean_data = self.data.get('airquality', {}).get('daily_mean_pm', []) or []
        self.diurnal = self.data.get('airquality', {}).get('diurnal', []) or []
        self.monthly_data = self.data.get('airquality', {}).get('site_monthly_mean_pm', []) or []
        self.site_names = [item.get('site_name', 'Unknown') for item in self.data.get('airquality', {}).get('site_annual_mean_pm', [])] or ['Unknown']
        self.num_sites = self.data.get('airquality', {}).get('sites', {}).get('number_of_sites', 'Unknown')
        self.starttime = self.data.get('airquality', {}).get('period', {}).get('startTime', '')[:10] or 'N/A'
        self.endtime = self.data.get('airquality', {}).get('period', {}).get('endTime', '')[:10] or 'N/A'

        self.annual_pm2_5 = self.annual_data.get("pm2_5_calibrated_value", 'N/A')
        self.gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        self.lock = threading.Lock()

        # Precompute for rule-based speed
        self.today_pm2_5 = self.daily_mean_data[0].get('pm2_5_calibrated_value', 'N/A') if self.daily_mean_data else 'N/A'
        self.peak_diurnal = max(self.diurnal, key=lambda x: x.get('pm2_5_calibrated_value', 0)) if self.diurnal else {}

        # Cache processed chatbot data for faster retrieval
        redis_client.setex(cache_key, 3600, json.dumps(self.__dict__))

    def _prepare_data_context(self):
        return (
            f"AirQo data for {self.grid_name} ({self.starttime}-{self.endtime}): "
            f"Annual PM2.5={self.annual_pm2_5} µg/m³, Sites={self.num_sites}, "
            f"Daily sample={self.daily_mean_data[:1]}, Diurnal sample={self.diurnal[:1]}, "
            f"Monthly sample={self.monthly_data[:1]}, Site names={self.site_names}."
        )

    def _rule_based_response(self, user_prompt):
        prompt = user_prompt.lower()

        if re.search(r"(today|now).*air.*quality", prompt):
            return f"Today’s PM2.5 in {self.grid_name} is {self.today_pm2_5} µg/m³."

        if re.search(r"(worst|highest|peak).*time", prompt):
            if self.peak_diurnal:
                return f"Pollution peaks at {self.peak_diurnal.get('hour', 'N/A')}:00 with {self.peak_diurnal.get('pm2_5_calibrated_value', 'N/A')} µg/m³."
            return "No diurnal data available."

        if re.search(r"how.*many.*(site|sites|monitors)", prompt):
            return f"There are {self.num_sites} monitoring sites in {self.grid_name}."

        if re.search(r"(year|annual).*average", prompt):
            return f"The annual PM2.5 average in {self.grid_name} is {self.annual_pm2_5} µg/m³."

        if re.search(r"(where|which|list).*site|sites|locations", prompt):
            return f"Monitoring sites in {self.grid_name}: {', '.join(self.site_names)}."

        return None

    def _llm_response(self, user_prompt):
        if re.search(r"(report|summary|detailed|analysis|conclusion)", user_prompt.lower()):
            full_prompt = (
                f"Data: {self._prepare_data_context()}\n"
                f"User: {user_prompt}\n"
                "Generate a concise conclusion or report based on the data. Focus on key insights."
            )
        else:
            full_prompt = (
                f"Data: {self._prepare_data_context()}\n"
                f"User: {user_prompt}\n"
                "Respond concisely and accurately based on the data."
            )

        try:
            response = self.gemini_model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            logging.error(f"LLM error: {e}")
            return "Sorry, I couldn't generate a response."

    def chat(self, user_prompt):
        if not user_prompt or not isinstance(user_prompt, str):
            return "Please provide a valid question about air quality."
        if len(user_prompt) > 500:
            return "Your question is too long. Please keep it under 500 characters."

        rule_response = self._rule_based_response(user_prompt)
        if rule_response:
            return rule_response
        return self._llm_response(user_prompt)