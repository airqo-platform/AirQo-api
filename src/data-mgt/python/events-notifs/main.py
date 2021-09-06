import os

from events import EventsJob

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "firebase.json"

if __name__ == "__main__":
    events_job = EventsJob()
    events_job.average_and_send_alerts()
