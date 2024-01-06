#!/bin/bash
mkdir -p "$AIRFLOW__CORE__XCOM_BACKEND_FOLDER" && cp -r /usr/local/bin/airflow_xcom/* "$AIRFLOW__CORE__XCOM_BACKEND_FOLDER"
echo "Copied Xcom Content to folder : $AIRFLOW__CORE__XCOM_BACKEND_FOLDER"
ls "$AIRFLOW__CORE__XCOM_BACKEND_FOLDER"
exit 0