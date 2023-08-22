import copy
from datetime import datetime, timedelta

from api.models import EventsModel
from api.utils.data_formatters import compute_devices_summary
from api.utils.dates import str_to_date
from config import Config


def create_date_list(start_date: datetime, end_date: datetime):
    date_list: list[datetime] = []
    current_date = start_date

    while current_date <= end_date:
        date_list.append(current_date)
        current_date += timedelta(days=1)

    return date_list


def compute_historical_summary():
    model = EventsModel("airqo")
    start_date = str_to_date("2023-01-01", format="%Y-%m-%d")
    end_date = str_to_date("2023-01-10", format="%Y-%m-%d")
    date_list = create_date_list(start_date, end_date)
    for date in date_list:
        date_data = model.get_devices_hourly_data(day=date)
        date_summary = compute_devices_summary(copy.deepcopy(date_data))
        model.save_devices_summary_data(copy.deepcopy(date_summary))


if __name__ == "__main__":
    events_model = EventsModel("airqo")
    data = events_model.get_devices_hourly_data(
        day=datetime.utcnow() - timedelta(days=int(Config.DATA_SUMMARY_DAYS_INTERVAL))
    )
    summary = compute_devices_summary(copy.deepcopy(data))
    events_model.save_devices_summary_data(copy.deepcopy(summary))
