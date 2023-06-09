import copy
from datetime import datetime, timedelta

from api.models import EventsModel
from api.utils.data_formatters import compute_devices_summary

if __name__ == "__main__":
    events_model = EventsModel("airqo")
    data = events_model.get_devices_hourly_data(
        day=datetime.utcnow() - timedelta(days=1)
    )
    summary = compute_devices_summary(copy.deepcopy(data))
    events_model.save_devices_summary_data(copy.deepcopy(summary))
