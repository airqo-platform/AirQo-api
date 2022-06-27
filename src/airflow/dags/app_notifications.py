from datetime import datetime

from airflow.decorators import dag, task

test_countries = ["+256", "+255", "+254"]

# Runs at 5, 6, 7 and 8 (Monday) to send
# good morning greetings to users
# in timezones +3, +2, +1, 0 from UTC going to work
@dag(
    "Monday-Notifications",
    schedule_interval="10 8 * * 1",
    # schedule_interval="10 5,6,7,8 * * 1",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "monday", "morning"],
)
def monday_morning_notifications():
    def extract_recipients_by_timezone_offset():

        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi.get_notification_recipients_by_timezone_offset(hour=8)

    @task()
    def extract_recipients_by_countries():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi().get_notification_recipients_by_countries(test_countries)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_notification_utils import (
            create_notification_messages,
            NOTIFICATION_TEMPLATE_MAPPER,
        )
        from airqo_etl_utils.firebase_api import FirebaseApi

        templates = FirebaseApi.get_notification_templates(
            NOTIFICATION_TEMPLATE_MAPPER["monday_morning"]
        )

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_notification_utils import send_notification_messages

        send_notification_messages(messages=messages)

    recipients = extract_recipients_by_countries()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


# Runs at 16, 17, 18 and 19 (Friday) to send
# good evening greetings to users
# in timezones +3, +2, +1, 0 from UTC going to work
@dag(
    "Friday-Notifications",
    # schedule_interval="10 16,17,18,19 * * 5",
    schedule_interval="10 18 * * 5",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "friday", "evening"],
)
def friday_evening_notifications():
    def extract_recipients_by_timezone_offset():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi.get_notification_recipients_by_timezone_offset(hour=19)

    @task()
    def extract_recipients_by_countries():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi().get_notification_recipients_by_countries(test_countries)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_notification_utils import (
            create_notification_messages,
            NOTIFICATION_TEMPLATE_MAPPER,
        )
        from airqo_etl_utils.firebase_api import FirebaseApi

        templates = FirebaseApi.get_notification_templates(
            NOTIFICATION_TEMPLATE_MAPPER["friday_evening"]
        )

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_notification_utils import send_notification_messages

        send_notification_messages(messages=messages)

    recipients = extract_recipients_by_countries()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


# Runs at 5, 6, 7 and 8 (Tuesday - Sunday) to send good morning
# greetings and forcast (those with fav places)
# to users
# in timezones +3, +2, +1, 0 from UTC going to work
@dag(
    "Morning-Notifications",
    # schedule_interval="10 5,6,7,8 * * 0,2,3,4,5,6",
    schedule_interval="10 8 * * 0,2,3,4,5,6",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "morning"],
)
def morning_notifications():
    def extract_recipients_by_timezone_offset():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi.get_notification_recipients_by_timezone_offset(hour=8)

    @task()
    def extract_recipients_by_countries():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi().get_notification_recipients_by_countries(test_countries)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_notification_utils import (
            create_notification_messages,
            NOTIFICATION_TEMPLATE_MAPPER,
        )
        from airqo_etl_utils.firebase_api import FirebaseApi

        if datetime.utcnow().weekday in [5, 6]:
            template = NOTIFICATION_TEMPLATE_MAPPER["weekend_morning"]
        else:
            template = NOTIFICATION_TEMPLATE_MAPPER["weekday_morning"]

        templates = FirebaseApi.get_notification_templates(template)

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_notification_utils import send_notification_messages

        send_notification_messages(messages=messages)

    recipients = extract_recipients_by_countries()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


# Runs at 16, 17, 18 and 19 (Saturday - Thursday) to send notifications to
# users in timezones +3, +2, +1, 0 from UTC informing them of
# the forecast of one favourite place
@dag(
    "Evening-Notifications",
    # schedule_interval="10 16,17,18,19 * * 0,1,2,3,4,6",
    schedule_interval="10 18 * * 0,1,2,3,4,6",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "evening"],
)
def evening_notifications():
    def extract_recipients_by_timezone_offset():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi.get_notification_recipients_by_timezone_offset(hour=19)

    @task()
    def extract_recipients_by_countries():
        from airqo_etl_utils.firebase_api import FirebaseApi

        return FirebaseApi().get_notification_recipients_by_countries(test_countries)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_notification_utils import (
            create_notification_messages,
            NOTIFICATION_TEMPLATE_MAPPER,
        )
        from airqo_etl_utils.firebase_api import FirebaseApi

        if datetime.utcnow().weekday in [5, 6]:
            name = NOTIFICATION_TEMPLATE_MAPPER["weekend_evening"]
        else:
            name = NOTIFICATION_TEMPLATE_MAPPER["weekday_evening"]

        templates = FirebaseApi.get_notification_templates(name)

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_notification_utils import send_notification_messages

        send_notification_messages(messages=messages)

    recipients = extract_recipients_by_countries()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


monday_morning_notifications_dag = monday_morning_notifications()
friday_evening_notifications_dag = friday_evening_notifications()
morning_notifications_dag = morning_notifications()
evening_notifications_dag = evening_notifications()
