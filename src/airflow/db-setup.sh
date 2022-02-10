#!/bin/bash
airflow db init
airflow users create --role Admin --username airflow --email airflow@airflow.org --firstname airflow --lastname airflow --password airflow
exit 0