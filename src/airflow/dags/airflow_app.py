from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Airflow-App-Cleanup",
    schedule_interval="0 0 * * 0",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["cleanup"],
)
def aiflow_app_cleanup():

    @task()
    def delete_old_dag_runs():
        from airqo_etl_utils.airflow_custom_utils import AirflowUtils

        AirflowUtils().remove_old_dag_runs()

    delete_old_dag_runs()


aiflow_app_cleanup_dag = aiflow_app_cleanup()
