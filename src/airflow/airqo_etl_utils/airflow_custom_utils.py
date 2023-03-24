import base64
import json
import os
from datetime import datetime, timedelta

import requests
from airflow.hooks.base import BaseHook
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator

from .utils import Utils


class AirflowUtils:
    @staticmethod
    def dag_default_configs():
        return {
            "start_date": datetime.utcnow() - timedelta(days=2),
            "owner": "AirQo",
            "owner_links": {"AirQo": "https://airqo.africa"},
            "retries": 0,
            "on_failure_callback": AirflowUtils.dag_failure_notification,
        }

    def __init__(self) -> None:
        super().__init__()
        self.base_url = Utils.remove_suffix(
            os.getenv("AIRFLOW__WEBSERVER__BASE_URL"), suffix="/"
        )
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

    @staticmethod
    def dag_failure_notification(context):
        log_url = f"{context.get('task_instance').log_url}"
        log_url = f"{os.getenv('AIRFLOW__WEBSERVER__BASE_URL')}/{log_url[log_url.find('log'):]}"
        msg = f"""
                      :red_circle: Task Failed. 
                      *Dag*: {context.get("task_instance").dag_id} 
                      *Task*: {context.get("task_instance").task_id}  
                      *Execution Time*: {context.get("execution_date")}  
                      *Access Url*: {log_url} 
                      """

        slack_webhook_token = BaseHook.get_connection("slack").password

        failed_alert = SlackWebhookOperator(
            task_id="slack_failed_notification",
            http_conn_id="slack",
            webhook_token=slack_webhook_token,
            message=msg,
            username="airflow",
        )

        return failed_alert.execute(context=context)

    @staticmethod
    def dag_success_notification(context):
        log_url = f"{context.get('task_instance').log_url}"
        base_url = Utils.remove_suffix(
            os.getenv("AIRFLOW__WEBSERVER__BASE_URL"), suffix="/"
        )
        log_url = f"{base_url}/{log_url[log_url.find('log'):]}"
        msg = f"""
                      :red_circle: Task Failed. 
                      *Dag*: {context.get("task_instance").dag_id} 
                      *Task*: {context.get("task_instance").task_id}  
                      *Execution Time*: {context.get("execution_date")}  
                      *Access Url*: {log_url} 
                      """

        slack_webhook_token = BaseHook.get_connection("slack").password

        success_alert = SlackWebhookOperator(
            task_id="slack_success_notification",
            http_conn_id="slack",
            webhook_token=slack_webhook_token,
            message=msg,
            username="airflow",
        )

        return success_alert.execute(context=context)

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

    def remove_old_dag_runs(self, days: int):
        execution_date_time = datetime.utcnow() - timedelta(days=days)

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
