from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Airflow-App-Cleanup",
    schedule_interval="0 0 * * 0",
    catchup=False,
    tags=["cleanup"],
    default_args=AirflowUtils.dag_default_configs(),
)
def aiflow_app_cleanup():
    @task()
    def delete_old_dag_runs():
        from airqo_etl_utils.airflow_custom_utils import AirflowUtils

        AirflowUtils().remove_old_dag_runs()

    delete_old_dag_runs()


aiflow_app_cleanup_dag = aiflow_app_cleanup()
