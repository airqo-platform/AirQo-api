from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from utils import get_month, get_last_datetime, get_first_datetime, clean_up_task
from weather_measurements_utils import get_weather_measurements, transform_weather_measurements, \
    save_weather_measurements

default_args = {
    "owner": "airflow",
    "start_date": datetime(2020, 1, 1),
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "email": "devs@airqo.net",
    "retries": 1,
    "retry_delay": timedelta(minutes=5)
}
today = datetime.today()


def create_dag(dag_id, start_time, end_time, file_name, freq):
    schedule_interval = '@hourly' if freq == "hourly" else '@daily'
    time_delta = '3H' if freq == "hourly" else '30H'

    dag = DAG(dag_id,
              schedule_interval=schedule_interval,
              default_args=default_args,
              tags=['weather'] + file_name.split("_"))

    with dag:
        fetch_data = PythonOperator(
            task_id="fetch_data",
            python_callable=get_weather_measurements,
            op_args=[f'weather_{file_name}_uncleaned_data.csv', f'{start_time}', f'{end_time}', time_delta]
        )

        clean_data = PythonOperator(
            task_id='clean_data',
            python_callable=transform_weather_measurements,
            op_args=[f'weather_{file_name}_uncleaned_data.csv', f'weather_{file_name}_cleaned_data.json', freq]
        )

        save_data = PythonOperator(
            task_id='save_data',
            python_callable=save_weather_measurements,
            op_args=[f'weather_{file_name}_cleaned_data.json']
        )

        clean_up = PythonOperator(
            task_id='clean_up',
            python_callable=clean_up_task,
            op_args=[[f'weather_{file_name}_uncleaned_data.csv', f'weather_{file_name}_cleaned_data.json']]
        )

        fetch_data.set_downstream(clean_data)
        clean_data.set_downstream(save_data)
        save_data.set_downstream(clean_up)

    return dag


for year in ["2020", "2021", "2022"]:
    if int(year) > today.year:
        continue
    for month in range(1, 13):
        if month > today.month and int(year) == today.year:
            break
        for frequency in ["raw", "hourly", "daily"]:
            month_name = get_month(month)
            pipeline_id = 'weather_{}-{}_{}_measurements'.format(year, month_name, frequency)
            start = get_first_datetime(year, month)
            end = get_last_datetime(year, month)
            file = '{}_{}_{}'.format(year, month_name, frequency)

            globals()[pipeline_id] = create_dag(pipeline_id, start, end, file, frequency)

for frequency in ["hourly", "daily"]:
    pipeline_id = 'weather_{}_streams_measurements'.format(frequency)
    file = '{}'.format(frequency)
    globals()[pipeline_id] = create_dag(pipeline_id, None, None, file, frequency)
