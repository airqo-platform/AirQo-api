from datetime import datetime, timedelta

from airflow.decorators import dag, task

from date import first_day_of_week, first_day_of_month, last_day_of_week, last_day_of_month
from utils import save_insights_data


@dag('Delete-Insights', schedule_interval="@monthly",
     start_date=datetime(2021, 1, 1), catchup=False, tags=['insights', 'delete'])
def app_delete_insights_etl():
    @task()
    def delete():
        start_time = first_day_of_week(first_day_of_month(date_time=datetime.now())) - timedelta(days=7)
        end_time = last_day_of_week(last_day_of_month(date_time=datetime.now())) + timedelta(days=7)

        save_insights_data(insights_data=[], action="delete", start_time=start_time, end_time=end_time)

    delete()


app_delete_insights_dag = app_delete_insights_etl()
