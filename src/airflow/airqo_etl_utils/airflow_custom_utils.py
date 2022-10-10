import base64
from datetime import datetime, timedelta
import json
import os

import requests
from airflow.hooks.base import BaseHook
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator

from .config import configuration


class AirflowUtils:
    def __init__(self) -> None:
        super().__init__()
        self.base_url = os.getenv("AIRFLOW__WEBSERVER__BASE_URL").removesuffix("/")
        self.headers = {
            "Authorization": f"Basic {AirflowUtils.authentication_string()}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def authentication_string() -> str:
        username = os.getenv("ADMIN_USERNAME")
        password = os.getenv("ADMIN_PASSWORD")
        auth_bytes = f"{username}:{password}".encode("ascii")
        base64_bytes = base64.b64encode(auth_bytes)
        base64_string = base64_bytes.decode("ascii")
        return base64_string

    def __query_dag_runs(
        self, page_offset, dag_ids, execution_date_time, page_limit=100
    ):
        dag_runs_response = requests.post(
            f"{self.base_url}/api/v1/dags/~/dagRuns/list",
            data=json.dumps(
                {
                    "states": ["success", "failed"],
                    "execution_date_lte": execution_date_time,
                    "dag_ids": dag_ids,
                    "page_offset": page_offset,
                    "page_limit": page_limit,
                }
            ),
            headers=self.headers,
        )

        return dag_runs_response.json()

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

    def remove_old_dag_runs(self):

        execution_date_time = datetime.utcnow() - timedelta(days=14)

        dags_response = requests.get(
            f"{self.base_url}/api/v1/dags",
            headers=self.headers,
        )

        dag_ids = []
        for dag in dags_response.json()["dags"]:
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
            response = requests.delete(
                f"{self.base_url}/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}",
                headers=self.headers,
            )
            print(f"{dag_id} : {dag_run_id} : {response.status_code}")


def slack_success_notification(context):
    slack_webhook_token = BaseHook.get_connection("slack").password

    msg = """
          :green_circle: Task Successful. 
          *Task*: {task}  
          *Dag*: {dag} 
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        task=context.get("task_instance").task_id,
        dag=context.get("task_instance").dag_id,
        ti=context.get("task_instance"),
        exec_date=context.get("execution_date"),
        log_url=context.get("task_instance").log_url,
    )

    success_alert = SlackWebhookOperator(
        task_id="slack_success_notification",
        http_conn_id="slack",
        webhook_token=slack_webhook_token,
        message=msg,
        username="airflow",
    )

    return success_alert.execute(context=context)


def slack_dag_failure_notification(context):
    slack_webhook_token = BaseHook.get_connection("slack").password
    icon_color = (
        ":red_circle"
        if configuration.ENVIRONMENT.lower() == "production"
        else ":yellow_circle"
    )

    msg = """
          {icon_color}: Task Failed. 
          *Task*: {task}  
          *Dag*: {dag}
          *Execution Time*: {exec_date}  
          *Log Url*: {log_url} 
          """.format(
        icon_color=icon_color,
        task=context.get("task_instance").task_id,
        dag=context.get("task_instance").dag_id,
        ti=context.get("task_instance"),
        exec_date=context.get("execution_date"),
        log_url=context.get("task_instance").log_url,
    )

    failed_alert = SlackWebhookOperator(
        task_id="slack_failed_notification",
        http_conn_id="slack",
        webhook_token=slack_webhook_token,
        message=msg,
        username="airflow",
    )

    return failed_alert.execute(context=context)
