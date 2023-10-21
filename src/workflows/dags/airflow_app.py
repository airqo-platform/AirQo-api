from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "Airflow-App-Cleanup",
    schedule="0 0 * * 0",
    catchup=False,
    tags=["cleanup"],
    default_args=AirflowUtils.dag_default_configs(),
)
def aiflow_app_cleanup():
    @task()
    def delete_old_dag_runs(**kwargs):
        from airqo_etl_utils.workflows_custom_utils import AirflowUtils

        try:
            dag_run = kwargs.get("dag_run")
            days = int(dag_run.conf["days"])
        except Exception as ex:
            print(ex)
            days = 14

        AirflowUtils().remove_old_dag_runs(days)

    delete_old_dag_runs()


aiflow_app_cleanup()
