from airqo_measurements_utils import retrieve_airqo_raw_measurements, clean_airqo_measurements
from kcca_measurements_utils import retrieve_kcca_measurements, clean_kcca_measurements
from utils import save_measurements, clean_up_task
from weather_measurements_utils import transform_weather_measurements, get_weather_measurements, \
    save_weather_measurements


def kcca():
    retrieve_kcca_measurements("2021-01-01T00:00:00Z", "2021-01-10T00:00:00Z", "daily", "test-kcca.csv")
    clean_kcca_measurements("test-kcca.csv", "cleaned-test-kcca.json")
    save_measurements("cleaned-test-kcca.json", 'kcca')
    clean_up_task(["test-kcca.csv", "cleaned-test-kcca.json"])


def airqo_raw():
    retrieve_airqo_raw_measurements("2021-01-01T00:00:00Z", "2021-01-02T00:00:00Z", "test-airqo.csv")
    clean_airqo_measurements("test-airqo.csv", "cleaned-test-airqo.json")
    save_measurements("cleaned-test-airqo.json", 'airqo')
    clean_up_task(["test-airqo.csv", "cleaned-test-airqo.json"])


def weather_data():
    get_weather_measurements("test-weather.csv", "2021-01-01T00:00:00Z", "2021-01-02T00:00:00Z", )
    transform_weather_measurements("test-weather.csv", "cleaned-test-weather.json")
    save_weather_measurements("cleaned-test-weather.json")
    clean_up_task(["test-weather.csv", "cleaned-test-weather.json"])


if __name__ == "__main__":
    pass
