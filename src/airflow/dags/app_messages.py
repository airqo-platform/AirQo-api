from datetime import datetime
from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "App-Notifications",
    schedule_interval="@hourly",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications"],
)
def app_notifications_etl():
    @task(multiple_outputs=True)
    def extract_notifications_recipients():
        from airqo_etl_utils.app_messaging_utils import (
            get_notification_recipients,
        )

        recipients = get_notification_recipients()

        return dict({"data": recipients})

    @task(multiple_outputs=True)
    def extract_notification_templates_and_insights():
        from airqo_etl_utils.app_messaging_utils import (
            get_notification_templates,
            get_latest_insights,
        )

        templates = get_notification_templates()
        latest_insights = get_latest_insights()

        return dict({"templates": templates, "insights": latest_insights})

    @task()
    def create_notifications(meta_data: dict, recipients_data: dict):
        from airqo_etl_utils.commons import fill_nan

        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
        )

        message_templates = meta_data.get("templates")
        insights = meta_data.get("insights")
        recipients = recipients_data.get("data")

        notification_messages = create_notification_messages(
            templates=message_templates, recipients=recipients, insights=insights
        )

        return dict({"data": fill_nan(data=notification_messages)})

    @task()
    def send_notifications(data: dict):
        from airqo_etl_utils.app_messaging_utils import send_notification_messages

        messages = data.get("data")
        print(f"Messages to be sent : {len(messages)}")
        send_notification_messages(messages=messages)

    recipients_result = extract_notifications_recipients()
    notification_meta_data = extract_notification_templates_and_insights()
    notifications = create_notifications(
        message_template_data=notification_meta_data,
        recipients_data=recipients_result,
    )
    send_notifications(data=notifications)


app_notifications_etl_dag = app_notifications_etl()
