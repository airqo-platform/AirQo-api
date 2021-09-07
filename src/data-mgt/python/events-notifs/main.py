import os

import firebase_admin

from events import EventsJob

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "firebase.json"

if __name__ == "__main__":
    firebase_admin.initialize_app()
    events_job = EventsJob()
    events_job.average_and_send_alerts()
