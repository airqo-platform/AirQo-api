from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


# Runs at 5, 6, 7 and 8 (Monday) to send
# good morning greetings to users
# in timezones +3, +2, +1, 0 from UTC going to work
@dag(
    "Monday-Notifications",
    schedule_interval="20 5,6,7,8 * * 1",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "monday", "morning"],
)
def monday_morning_notifications():
    @task()
    def extract_recipients():
        from airqo_etl_utils.app_messaging_utils import get_notification_recipients

        return get_notification_recipients(hour=8)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
            get_notification_templates,
            NOTIFICATION_TEMPLATE_MAPPER,
        )

        templates = get_notification_templates(
            NOTIFICATION_TEMPLATE_MAPPER["monday_morning"]
        )

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_messaging_utils import send_notification_messages

        print(f"Messages to be sent : {len(messages)}")
        send_notification_messages(messages=messages)

    recipients = extract_recipients()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


# Runs at 16, 17, 18 and 19 (Friday) to send
# good evening greetings to users
# in timezones +3, +2, +1, 0 from UTC going to work
@dag(
    "Friday-Notifications",
    schedule_interval="20 16,17,18,19 * * 5",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "friday", "evening"],
)
def friday_evening_notifications():
    @task()
    def extract_recipients():
        from airqo_etl_utils.app_messaging_utils import get_notification_recipients

        return get_notification_recipients(hour=19)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
            get_notification_templates,
            NOTIFICATION_TEMPLATE_MAPPER,
        )

        templates = get_notification_templates(
            NOTIFICATION_TEMPLATE_MAPPER["friday_evening"]
        )

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_messaging_utils import send_notification_messages

        print(f"Messages to be sent : {len(messages)}")
        send_notification_messages(messages=messages)

    recipients = extract_recipients()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


# Runs at 5, 6, 7 and 8 (Tuesday - Friday) to send good morning
# greetings and forcast (those with fav places)
# to users
# in timezones +3, +2, +1, 0 from UTC going to work
@dag(
    "Morning-Notifications",
    schedule_interval="20 5,6,7,8 * * 2,3,4,5",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "morning"],
)
def morning_notifications():
    @task()
    def extract_recipients():
        from airqo_etl_utils.app_messaging_utils import get_notification_recipients

        return get_notification_recipients(hour=8)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
            get_notification_templates,
            NOTIFICATION_TEMPLATE_MAPPER,
        )

        templates = get_notification_templates(
            NOTIFICATION_TEMPLATE_MAPPER["every_morning"]
        )

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_messaging_utils import send_notification_messages

        print(f"Messages to be sent : {len(messages)}")
        send_notification_messages(messages=messages)

    recipients = extract_recipients()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


# Runs at 16, 17, 18 and 19 (Monday - Thursday) to send notifications to
# users in timezones +3, +2, +1, 0 from UTC informing them of
# the forecast of one favourite place
@dag(
    "Evening-Notifications",
    schedule_interval="20 16,17,18,19 * * 1,2,3,4",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications", "evening"],
)
def evening_notifications():
    @task()
    def extract_recipients():
        from airqo_etl_utils.app_messaging_utils import get_notification_recipients

        return get_notification_recipients(hour=19)

    @task()
    def create_notifications(data):

        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
            get_notification_templates,
            NOTIFICATION_TEMPLATE_MAPPER,
        )

        templates = get_notification_templates(
            NOTIFICATION_TEMPLATE_MAPPER["every_evening"]
        )

        return create_notification_messages(templates=templates, recipients=data)

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_messaging_utils import send_notification_messages

        print(f"Messages to be sent : {len(messages)}")
        send_notification_messages(messages=messages)

    recipients = extract_recipients()
    notifications = create_notifications(recipients)
    send_notifications(notifications)


monday_morning_notifications_dag = monday_morning_notifications()
friday_evening_notifications_dag = friday_evening_notifications()
morning_notifications_dag = morning_notifications()
evening_notifications_dag = evening_notifications()
