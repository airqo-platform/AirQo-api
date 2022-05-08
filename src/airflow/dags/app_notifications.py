from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "App-Monday-Notifications",
    schedule_interval="30 * * * 1",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications"],
)
def app_monday_notifications():
    hour = 8

    @task()
    def extract_recipients():
        from airqo_etl_utils.app_messaging_utils import (
            get_notification_recipients,
        )

        recipients = get_notification_recipients(hour)
        return recipients

    @task()
    def create_notifications(recipients):

        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
            get_notification_templates,
        )

        templates = get_notification_templates(hour)

        notification_messages = create_notification_messages(
            templates=templates, recipients=recipients
        )

        return notification_messages

    @task()
    def send_notifications(messages):
        from airqo_etl_utils.app_messaging_utils import send_notification_messages

        print(f"Messages to be sent : {len(messages)}")
        send_notification_messages(messages=messages)

    users = extract_recipients()
    notifications = create_notifications(users)
    send_notifications(notifications)


app_monday_notifications_dag = app_monday_notifications()
