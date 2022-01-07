from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from airqo_measurements_utils import retrieve_airqo_raw_measurements, add_weather_data, clean_airqo_measurements
from utils import save_measurements, clean_up_task, get_month, get_first_datetime, get_last_datetime

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


# slack_token = BaseHook.get_connection("slack_conn").password


def create_dag(dag_id, start_time, end_time, file_name, freq):
    dag = DAG(dag_id,
              schedule_interval=None,
              default_args=default_args,
              tags=['airqo'] + file_name.split("_"))

    if freq == "raw":

        with dag:
            fetch_data = PythonOperator(
                task_id="fetch_data",
                python_callable=retrieve_airqo_raw_measurements,
                op_args=[f'{start_time}', f'{end_time}', f'airqo_{file_name}_uncleaned_data.csv']
            )

            clean_data = PythonOperator(
                task_id='clean_data',
                python_callable=clean_airqo_measurements,
                op_args=[f'airqo_{file_name}_uncleaned_data.csv', f'airqo_{file_name}_cleaned_data.json']
            )

            save_data = PythonOperator(
                task_id='save_data',
                python_callable=save_measurements,
                op_args=[f'airqo_{file_name}_cleaned_data.json', 'airqo']
            )

            clean_up = PythonOperator(
                task_id='clean_up',
                python_callable=clean_up_task,
                op_args=[[f'airqo_{file_name}_uncleaned_data.csv', f'airqo_{file_name}_cleaned_data.json']]
            )

            fetch_data >> clean_data >> save_data >> clean_up

        return dag

    elif freq == "hourly" or freq == "daily":

        with dag:
            fetch_data = PythonOperator(
                task_id="fetch_data",
                python_callable=retrieve_airqo_raw_measurements,
                op_args=[f'{start_time}', f'{end_time}', f'airqo_{file_name}_uncleaned_data.csv']
            )

            add_averaged_weather_data = PythonOperator(
                task_id='add_averaged_weather_data',
                python_callable=add_weather_data,
                op_args=[f'airqo_{file_name}_uncleaned_data.csv', f'airqo_{file_name}_averaged_data.csv', freq]
            )

            clean_data = PythonOperator(
                task_id='clean_data',
                python_callable=clean_airqo_measurements,
                op_args=[f'airqo_{file_name}_averaged_data.csv', f'airqo_{file_name}_cleaned_data.csv']
            )

            save_data = PythonOperator(
                task_id='save_data',
                python_callable=save_measurements,
                op_args=[f'airqo_{file_name}_cleaned_data.csv', 'airqo']
            )

            clean_up = PythonOperator(
                task_id='clean_up',
                python_callable=clean_up_task,
                op_args=[[f'airqo_{file_name}_uncleaned_data.csv', f'airqo_{file_name}_averaged_data.csv',
                          f'airqo_{file_name}_cleaned_data.csv']]
            )

            # notify_dev_team = SlackWebhookOperator(
            #     task_id='notify_dev_team',
            #     http_conn_id='slack_conn',
            #     webhook_token=slack_token,
            #     message="Data Science Notification \n"
            #             "New Invoice Data is loaded into invoices table. \n "
            #             "Here is a celebration kitty: "
            #             "",
            #     username='airflow',
            #     icon_url='',
            #     dag=dag
            # )

            fetch_data >> add_averaged_weather_data >> clean_data >> save_data >> clean_up

        return dag

    else:
        Exception("Invalid frequency")
        return None


for year in ["2018", "2019", "2020", "2021", "2022"]:
    if int(year) > today.year:
        continue
    for month in range(1, 13):
        if month > today.month and int(year) == today.year:
            break
        for frequency in ["raw", "hourly", "daily"]:
            month_name = get_month(month)
            pipeline_id = 'airqo_{}-{}_{}_measurements'.format(year, month_name, frequency)
            start = get_first_datetime(year, month)
            end = get_last_datetime(year, month)
            file = '{}_{}_{}'.format(year, month_name, frequency)

            # globals()[pipeline_id] = create_dag(pipeline_id, start, end, file, frequency)
