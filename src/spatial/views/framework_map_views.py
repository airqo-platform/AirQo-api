import os
import logging
from flask import render_template, jsonify
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class AQIColorView:
    def __init__(self):
        self.access_token = os.getenv('AIRQO_API_TOKEN')
        self.mapbox_token = os.getenv('MAPBOX_ACCESS_TOKEN')

    def fetch_pm25_data(self, grid_id):
        api_url = f"https://api.airqo.net/api/v2/devices/measurements/grids/{grid_id}?token={self.access_token}"
        try:
            response = requests.get(api_url)
            response.raise_for_status()  # Raise an HTTPError for bad responses (4xx and 5xx)
            data = response.json()
            if 'measurements' in data:
                return data['measurements'], None
            else:
                return None, "No data found"
        except requests.exceptions.RequestException as e:
            return None, f"Request failed: {str(e)}"

    def pm25_map(self, grid_id):
        pm25_data, error = self.fetch_pm25_data(grid_id)
        if pm25_data:
            formatted_data = [{
                'date': measurement.get('time'),
                'pm25': measurement.get('pm2_5', {}).get('value'),
                'lat': measurement.get('siteDetails', {}).get('approximate_latitude'),
                'lon': measurement.get('siteDetails', {}).get('approximate_longitude'),
                'name': measurement.get('siteDetails', {}).get('formatted_name') or measurement.get('siteDetails', {}).get('name')
            } for measurement in pm25_data]

            return render_template('map.html', pm25_data=formatted_data, mapbox_token=self.mapbox_token)
        else:
            return jsonify({'error': error}), 404
