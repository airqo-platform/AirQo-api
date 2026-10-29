import base64
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from airflow.providers.slack.hooks.slack_webhook import SlackWebhookHook

from .date import DateUtils
from .http_client import HttpClient
from .utils import Utils


class AirflowUtils:
    @staticmethod
    def dag_default_configs() -> dict:
        return {
            "start_date": datetime(2026, 10, 1, tzinfo=timezone.utc),
            "owner": "AirQo",
            "owner_links": {"AirQo": "https://airqo.africa"},
            "on_failure_callback": AirflowUtils.dag_failure_notification,
        }

    def __init__(self) -> None:
        super().__init__()
        self.base_url = AirflowUtils.web_base_url()
        self.headers = {
            "Authorization": f"Basic {AirflowUtils.authentication_string()}",
            "Content-Type": "application/json",
        }
        self.client = HttpClient()

    @staticmethod
    def authentication_string() -> str:
        username = os.getenv("ADMIN_USERNAME")
        password = os.getenv("ADMIN_PASSWORD")
        auth_bytes = f"{username}:{password}".encode("ascii")
        base64_bytes = base64.b64encode(auth_bytes)
        base64_string = base64_bytes.decode("ascii")
        return base64_string

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

    def __query_dag_runs(
        self, page_offset, dag_ids, execution_date_time, page_limit=100
    ):
        return self.client.post(
            f"{self.base_url}/api/v1/dags/~/dagRuns/list",
            json={
                "states": ["success", "failed"],
                "execution_date_lte": execution_date_time,
                "dag_ids": dag_ids,
                "page_offset": page_offset,
                "page_limit": page_limit,
            },
            headers=self.headers,
        )

    def get_dag_runs(self, dag_ids, execution_date_time, page_limit=100, page_offset=0):
        dag_runs = []
        dag_runs_response = self.__query_dag_runs(
            page_offset=page_offset,
            dag_ids=dag_ids,
            execution_date_time=execution_date_time,
            page_limit=page_limit,
        )
        total_entries = dag_runs_response["total_entries"]
        dag_runs.extend(dag_runs_response["dag_runs"])
        while total_entries != len(dag_runs):
            next_page = self.__query_dag_runs(
                page_offset=len(dag_runs),
                dag_ids=dag_ids,
                execution_date_time=execution_date_time,
                page_limit=page_limit,
            )
            dag_runs.extend(next_page["dag_runs"])

        return dag_runs

    def remove_old_dag_runs(self, days: int):
        execution_date_time = datetime.now(timezone.utc) - timedelta(days=days)

        dags_response = self.client.get_json(
            f"{self.base_url}/api/v1/dags",
            headers=self.headers,
        )

        dag_ids = []
        for dag in dags_response["dags"]:
            dag_ids.append(dag.get("dag_id"))

        dag_runs = self.get_dag_runs(
            execution_date_time=datetime.strftime(
                execution_date_time, "%Y-%m-%dT%H:00:00Z"
            ),
            dag_ids=dag_ids,
        )

        for dag_run in dag_runs:
            dag_id = dag_run.get("dag_id")
            dag_run_id = dag_run.get("dag_run_id")
            response = self.client.delete(
                f"{self.base_url}/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}",
                headers=self.headers,
            )
            print(f"{dag_id} : {dag_run_id} : {response.status_code}")
