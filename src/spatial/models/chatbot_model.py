import requests
from configure import Config
import google.generativeai as genai
import logging
import re
from flask import Flask, request, jsonify
from functools import lru_cache
import threading

# Configure API keys
GOOGLE_API_KEY = Config.GOOGLE_API_KEY
genai.configure(api_key=GOOGLE_API_KEY)

# Flask app
app = Flask(__name__)

class DataFetcher:
    @staticmethod
    @lru_cache(maxsize=100)  # Cache for speed
    def fetch_air_quality_data_a(grid_id, start_time, end_time):
        token = Config.AIRQO_API_TOKEN
        analytics_url = Config.ANALTICS_URL
        if token is None:
            logging.error("AIRQO_API_TOKEN not set.")
            return None

        url = f"{analytics_url}?token={token}"
        payload = {"grid_id": grid_id, "start_time": start_time, "end_time": end_time}

       
        try:
            response = requests.post(url, json=payload, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as http_err:
            logging.error(f"HTTP error: {http_err}")
        except requests.exceptions.RequestException as req_err:
            logging.error(f"Request error: {req_err}")
        except ValueError as json_err:
            logging.error(f"JSON error: {json_err}")
        return None

class AirQualityChatbot:
    def __init__(self, data):
        self.data = data
        self.grid_name = data.get('airquality', {}).get('sites', {}).get('grid name', ['Unknown'])[0]
        self.annual_data = data.get('airquality', {}).get('annual_pm', [{}])[0] or {}
        self.daily_mean_data = data.get('airquality', {}).get('daily_mean_pm', []) or []
        self.diurnal = data.get('airquality', {}).get('diurnal', []) or []
        self.monthly_data = data.get('airquality', {}).get('site_monthly_mean_pm', []) or []
        self.site_names = [item.get('site_name', 'Unknown') for item in data.get('airquality', {}).get('site_annual_mean_pm', [])] or ['Unknown']
        self.num_sites = data.get('airquality', {}).get('sites', {}).get('number_of_sites', 'Unknown')
        self.starttime = data.get('airquality', {}).get('period', {}).get('startTime', '')[:10] or 'N/A'
        self.endtime = data.get('airquality', {}).get('period', {}).get('endTime', '')[:10] or 'N/A'

        self.annual_pm2_5 = self.annual_data.get("pm2_5_calibrated_value", 'N/A')
        self.gemini_model = genai.GenerativeModel('gemini-pro')
        self.lock = threading.Lock()

        # Precompute for rule-based speed
        self.today_pm2_5 = self.daily_mean_data[0].get('pm2_5_calibrated_value', 'N/A') if self.daily_mean_data else 'N/A'
        self.peak_diurnal = max(self.diurnal, key=lambda x: x.get('pm2_5_calibrated_value', 0)) if self.diurnal else {}

    def _prepare_data_context(self):
        return (
            f"AirQo data for {self.grid_name} ({self.starttime}-{self.endtime}): "
            f"Annual PM2.5={self.annual_pm2_5} µg/m³, Sites={self.num_sites}, "
            f"Daily sample={self.daily_mean_data[:1]}, Diurnal sample={self.diurnal[:1]}, "
            f"Monthly sample={self.monthly_data[:1]}, Site names={self.site_names}"
        )

    def _rule_based_response(self, user_prompt):
        prompt = user_prompt.lower()

        if re.search(r"(today|now).*air.*quality", prompt):
            return f"Today’s PM2.5 in {self.grid_name} is {self.today_pm2_5} µg/m³."

        if re.search(r"(worst|highest|peak).*time", prompt):
            if self.peak_diurnal:
                return f"Pollution peaks at {self.peak_diurnal.get('hour', 'N/A')}:00 with {self.peak_diurnal.get('pm2_5_calibrated_value', 'N/A')} µg/m³."
            return "No diurnal data available."

        if re.search(r"how.*many.*(sites|monitors)", prompt):
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
            return "Sorry, I couldn’t process that right now."

    def chat(self, user_prompt):
        rule_response = self._rule_based_response(user_prompt)
        if rule_response:
            return rule_response
        return self._llm_response(user_prompt)

