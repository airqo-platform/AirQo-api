#!/bin/bash
airflow db init
airflow users create --role Admin --username "$ADMIN_USERNAME" --email airflow@airflow.org --firstname airflow --lastname airflow --password "$ADMIN_USERNAME"
exit 0