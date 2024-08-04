import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from airqo_etl_utils.config import configuration


class OpenMeteoWeatherAPI:
    def __init__(self):
        self.BASE_URL = configuration.OPEN_METEO_BASE_URL

    def fetch_current_weather_data(self, latitude, longitude):
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current_weather": "temperature_2m,wind_speed_10m,relative_humidity_2m",
        }

        try:
            response = requests.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            return data
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data for {latitude}, {longitude}: {e}")
            return None

    def fetch_weather_data_for_batch(self, lat_lon_dat, max_workers=5):
        results = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(self.fetch_current_weather_data, row[0], row[1])
                for row in lat_lon_dat.values
            ]
            for future in as_completed(futures):
                result = future.result()
                results.append(result)
                if result:
                    print(f"Weather data: {result}")

        return results
