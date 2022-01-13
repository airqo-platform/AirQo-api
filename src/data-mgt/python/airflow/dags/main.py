from airqo_measurements_utils import retrieve_airqo_raw_measurements, clean_airqo_measurements
from app_insights import get_insights_averaged_data, create_insights_data, get_insights_forecast
from kcca_measurements import extract_kcca_measurements, transform_kcca_measurements
from utils import clean_up_task, save_measurements_via_api
from weather_measurements import transform_weather_measurements, extract_weather_measurements, \
    load_weather_measurements


def kcca():
    kcca_unclean_data = extract_kcca_measurements("2021-01-01T08:00:00Z", "2021-01-01T12:00:00Z", "hourly")
    cleaned_data = transform_kcca_measurements(kcca_unclean_data)
    save_measurements_via_api(measurements=cleaned_data, tenant='kcca')


def airqo_raw():
    retrieve_airqo_raw_measurements("2021-01-01T00:00:00Z", "2021-01-02T00:00:00Z", "test-airqo.csv")
    clean_airqo_measurements("test-airqo.csv", "cleaned-test-airqo.json")
    save_measurements_via_api("cleaned-test-airqo.json", 'airqo')
    clean_up_task(["test-airqo.csv", "cleaned-test-airqo.json"])


def weather_data():
    data = extract_weather_measurements(start_time="2021-01-01T5:00:00Z", end_time="2021-01-01T17:00:00Z")
    cleaned_data = transform_weather_measurements(data)
    load_weather_measurements(cleaned_data)


def insights_data():
    get_insights_forecast("airqo", "test-insights-forecast.csv")
    get_insights_averaged_data("airqo", "test-insights-averaged.csv")
    create_insights_data("test-insights-forecast.csv", "test-insights-averaged.csv", "insights.json")
    clean_up_task(["test-insights-forecast.csv", "test-insights-averaged.csv", "insights.json"])


if __name__ == "__main__":
    pass
