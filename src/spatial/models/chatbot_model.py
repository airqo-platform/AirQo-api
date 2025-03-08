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

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure API keys
GOOGLE_API_KEY = Config.GOOGLE_API_KEY
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Redis client
try:
    redis_client = redis.StrictRedis(
        host=Config.REDIS_HOST or 'localhost',
        port=Config.REDIS_PORT or 6379,
        db=Config.REDIS_DB or 0,
        password=Config.REDIS_PASSWORD or None,
        decode_responses=True
    )
    # Test the connection 
    redis_client.ping()
    logging.info("Connected to Redis")
except Exception as e:
    logging.error(f"Error connecting to Redis: {e}")
    redis_client = None
# lock for thread safety to prevent race conditions when multiple users request the same data.
data_fetch_lock = threading.Lock()

class DataFetcher:
    @staticmethod
    def fetch_air_quality_data(grid_id, start_time, end_time):
        """Fetch air quality data and cache it in Redis to avoid redundant API calls."""
        cache_key = f"air_quality:{grid_id}:{start_time}:{end_time}"
        
        # Check if data is cached in Redis
        cached_data = None
        if redis_client:
            try:
                cached_data = redis_client.get(cache_key)
            except Exception as e:
                logging.error(f"Error retrieving data from Redis: {e}")
        else:
            logging.error("Redis client not available, skipping cache check")

        if cached_data:
            logging.info(f"Retrieved cached data for {cache_key}")
            return json.loads(cached_data)

        token = Config.AIRQO_API_TOKEN
        analytics_url = Config.ANALTICS_URL
        if not token:
            logging.error("AIRQO_API_TOKEN is not set.")
            return None

        query_params = {'token': token}
        url = f"{analytics_url}?{urlencode(query_params)}"
        payload = {"grid_id": grid_id, "start_time": start_time, "end_time": end_time}
        logging.info(f"Fetching air quality data with payload: {payload}")

        try:
            response = requests.post(url, json=payload, timeout=5)
            response.raise_for_status()
            data = response.json()
            # Cache response in Redis for 1 hour
            # setex is 
            with data_fetch_lock:
                if redis_client:
                    redis_client.setex(cache_key, 3600, json.dumps(data))
            logging.info(f"Data fetched and cached for grid_id: {grid_id}")
            return data
        except requests.exceptions.HTTPError as http_err:
            logging.error(f"HTTP error: {http_err}")
        except requests.exceptions.RequestException as req_err:
            logging.error(f"Request error: {req_err}")
        except ValueError as json_err:
            logging.error(f"JSON error: {json_err}")
        return None
    
class AirQualityChatbot:
    def __init__(self, air_quality_data):
        self.data = air_quality_data or {} 
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

        # Sort daily_mean_data to get the most recent measurement
        if self.daily_mean_data:
            sorted_daily = sorted(self.daily_mean_data, key=lambda x: x.get('date', ''), reverse=True)
            self.today_pm2_5 = sorted_daily[0].get('pm2_5_calibrated_value', 'N/A') if sorted_daily else 'N/A'
            self.today_date = sorted_daily[0].get('date', 'N/A') if sorted_daily else 'N/A'
        else:
            self.today_pm2_5 = 'N/A'
            self.today_date = 'N/A'

        self.peak_diurnal = max(self.diurnal, key=lambda x: x.get('pm2_5_calibrated_value', 0)) if self.diurnal else {}
        
        try:
            # Gemini model
            self.gemini_model = genai.GenerativeModel('gemini-2.0-flash')
        except Exception as e:
            logging.error(f"Failed to initialize Gemini model: {e}")
            self.gemini_model = None
        self.lock = threading.Lock()

    def _prepare_data_context(self):
        """Prepare a concise data context for the LLM."""
        return (
            f"AirQo data for {self.grid_name} ({self.starttime}-{self.endtime}): "
            f"Annual PM2.5={self.annual_pm2_5} µg/m³, Sites={self.num_sites}, "
            f"Most recent daily PM2.5={self.today_pm2_5} µg/m³ on {self.today_date}, "
            f"Diurnal peak={self.peak_diurnal.get('pm2_5_calibrated_value', 'N/A')} µg/m³ at {self.peak_diurnal.get('hour', 'N/A')}:00, "
            f"Site names={self.site_names}."
        )

    def _rule_based_response(self, user_prompt):
        """Handle common queries with precomputed responses."""
        prompt = user_prompt.lower()

        if re.search(r"(today|now).*air.*quality", prompt):
            if self.today_pm2_5 != 'N/A':
                return f"The most recent PM2.5 in {self.grid_name} is {self.today_pm2_5} µg/m³ on {self.today_date}."
            return "No recent air quality data available."

        if re.search(r"(worst|highest|peak).*time", prompt):
            if self.peak_diurnal:
                return f"Pollution peaks at {self.peak_diurnal.get('hour', 'N/A')}:00 with {self.peak_diurnal.get('pm2_5_calibrated_value', 'N/A')} µg/m³."
            return "No diurnal data available."

        if re.search(r"how.*many.*(site|sites|monitors)", prompt):
            if self.num_sites != 'Unknown':
                return f"There are {self.num_sites} monitoring sites in {self.grid_name}."
            return "Number of sites is not available."

        if re.search(r"(year|annual).*average", prompt):
            if self.annual_pm2_5 != 'N/A':
                return f"The annual PM2.5 average in {self.grid_name} is {self.annual_pm2_5} µg/m³."
            return "Annual air quality data is not available."

        if re.search(r"(where|which|list).*site|sites|locations", prompt):
            if self.site_names != ['Unknown']:
                return f"Monitoring sites in {self.grid_name}: {', '.join(self.site_names)}."
            return "Site information is not available."
    
        return None

    def _llm_response(self, user_prompt):
        """Generate a response using the Gemini model for complex queries."""
        if not self.gemini_model:
            return "Language model is not available."

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
        """Process user queries and return appropriate responses."""
        if not self.data:
            return "Air quality data is not available for the specified grid and time period."
        if not user_prompt or not isinstance(user_prompt, str):
            return "Please provide a valid question about air quality."
        if len(user_prompt) > 500:
            return "Your question is too long. Please keep it under 500 characters."

        rule_response = self._rule_based_response(user_prompt)
        if rule_response:
            return rule_response
        return self._llm_response(user_prompt)