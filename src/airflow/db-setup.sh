#!/bin/bash
airflow db init
airflow users create --role Admin --username "$AIRFLOW_UI_USER" --email airflow@airflow.org --firstname airflow --lastname airflow --password "$AIRFLOW_UI_USER"
exit 0