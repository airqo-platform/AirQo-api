from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from kcca_historical_measurements_utils import retrieve_kcca_measurements, clean_kcca_measurements
from utils import get_month, get_last_datetime, get_first_datetime, save_measurements, clean_up_task


default_args = {
    "owner": "airflow",
    "start_date": datetime(2019, 1, 1),
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "email": "devs@airqo.net",
    "retries": 1,
    "retry_delay": timedelta(minutes=5)
}
today = datetime.today()


def create_dag(dag_id, start_time, end_time, file_name, freq):

    dag = DAG(dag_id,
              schedule_interval=None,
              default_args=default_args,
              tags=['kcca'] + file_name.split("_"))

    with dag:
        fetch_data = PythonOperator(
            task_id="fetch_data",
            python_callable=retrieve_kcca_measurements,
            op_args=[f'{start_time}', f'{end_time}', freq, f'kcca_{file_name}_uncleaned_data.csv']
        )

        clean_data = PythonOperator(
            task_id='clean_data',
            python_callable=clean_kcca_measurements,
            op_args=[f'kcca_{file_name}_uncleaned_data.csv', f'kcca_{file_name}_cleaned_data.json']
        )

        save_data = PythonOperator(
            task_id='save_data',
            python_callable=save_measurements,
            op_args=[f'kcca_{file_name}_cleaned_data.json', 'kcca']
        )

        clean_up = PythonOperator(
            task_id='clean_up',
            python_callable=clean_up_task,
            op_args=[[f'kcca_{file_name}_uncleaned_data.csv', f'kcca_{file_name}_cleaned_data.json']]
        )

        fetch_data.set_downstream(clean_data)
        clean_data.set_downstream(save_data)
        save_data.set_downstream(clean_up)

    return dag


for year in ["2019", "2020", "2021", "2022"]:
    if int(year) > today.year:
        continue
    for month in range(1, 13):
        if month > today.month and int(year) == today.year:
            break
        for frequency in ["raw", "hourly", "daily"]:

            month_name = get_month(month)
            pipeline_id = 'kcca_{}-{}_{}_measurements'.format(year, month_name, frequency)
            start = get_first_datetime(year, month)
            end = get_last_datetime(year, month)
            file = '{}_{}_{}'.format(year, month_name, frequency)

            globals()[pipeline_id] = create_dag(pipeline_id, start, end, file, frequency)
