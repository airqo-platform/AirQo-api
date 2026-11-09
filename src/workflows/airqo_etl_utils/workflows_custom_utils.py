import os
from datetime import datetime, timezone
from urllib.parse import urlsplit

from airflow.providers.slack.hooks.slack_webhook import SlackWebhookHook

from .date import DateUtils


class AirflowUtils:
    @staticmethod
    def dag_default_configs() -> dict:
        return {
            "start_date": datetime(2026, 10, 1, tzinfo=timezone.utc),
            "owner": "AirQo",
            "owner_links": {"AirQo": "https://airqo.africa"},
            "on_failure_callback": AirflowUtils.dag_failure_notification,
        }

    @staticmethod
    def web_base_url() -> str:
        """
        Returns the configured web base URL without a trailing slash. Reads the
        [api] base_url variable first and the [webserver] base_url variable second.
        """
        return (
            os.getenv("AIRFLOW__API__BASE_URL")
            or os.getenv("AIRFLOW__WEBSERVER__BASE_URL")
            or ""
        ).rstrip("/")

    @staticmethod
    def task_log_url(task_instance) -> str:
        """
        Returns the task instance log URL under the configured web base URL. A log URL
        that was joined onto the host alone is rebuilt with the base URL's path.
        """
        log_url = str(task_instance.log_url)
        base_url = AirflowUtils.web_base_url()
        if not base_url or log_url.startswith(base_url):
            return log_url
        parts = urlsplit(log_url)
        rebuilt = f"{base_url}{parts.path}"
        return f"{rebuilt}?{parts.query}" if parts.query else rebuilt

    @staticmethod
    def task_notification_text(context, heading: str) -> str:
        task_instance = context.get("task_instance") or context.get("ti")
        run_time = DateUtils.get_dag_run_time(
            dag_run=context.get("dag_run"), logical_date=context.get("logical_date")
        )
        return "\n".join(
            [
                heading,
                f"*Dag*: {task_instance.dag_id}",
                f"*Task*: {task_instance.task_id}",
                f"*Run*: {context.get('run_id')}",
                f"*Run Time*: {run_time}",
                f"*Access Url*: {AirflowUtils.task_log_url(task_instance)}",
            ]
        )

    @staticmethod
    def dag_failure_notification(context):
        text = AirflowUtils.task_notification_text(context, ":red_circle: Task Failed.")
        return SlackWebhookHook(slack_webhook_conn_id="slack").send(text=text)

    @staticmethod
    def dag_success_notification(context):
        text = AirflowUtils.task_notification_text(
            context, ":large_green_circle: Task Succeeded."
        )
        return SlackWebhookHook(slack_webhook_conn_id="slack").send(text=text)
