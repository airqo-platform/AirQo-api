from datetime import datetime
from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "App-Notifications",
    schedule_interval="0 10,18 * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["app", "notifications"],
)
def app_notifications_etl():
    @task(multiple_outputs=True)
    def extract_notifications_recipients():
        from airqo_etl_utils.app_messaging_utils import (
            get_notifications_recipients,
        )

        from airqo_etl_utils.commons import fill_nan

        recipients = get_notifications_recipients()

        return dict({"data": fill_nan(data=recipients)})

    @task(multiple_outputs=True)
    def extract_notification_template():
        from airqo_etl_utils.app_messaging_utils import (
            get_notification_template,
        )

        template = get_notification_template()

        return dict({"data": template})

    @task()
    def create_notifications(message_template_data: dict, recipients_data: dict):
        from airqo_etl_utils.commons import fill_nan

        from airqo_etl_utils.commons import un_fill_nan
        from airqo_etl_utils.app_messaging_utils import (
            create_notification_messages,
        )

        message_template = un_fill_nan(message_template_data.get("data"))
        recipients = un_fill_nan(recipients_data.get("data"))

        notifications = create_notification_messages(
            template=message_template, recipients=recipients
        )

        return dict({"data": fill_nan(data=notifications)})

    @task()
    def load(data: dict):
        from airqo_etl_utils.commons import un_fill_nan

        messages = un_fill_nan(data.get("data"))
        print(messages)

    recipients_result = extract_notifications_recipients()
    notification_template_result = extract_notification_template()
    notifications_result = create_notifications(
        message_template_data=notification_template_result,
        recipients_data=recipients_result,
    )
    load(data=notifications_result)


app_notifications_etl_dag = app_notifications_etl()
