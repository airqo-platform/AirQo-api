FROM apache/airflow
#ENV AIRFLOW_EXTRAS=slack,virtualenv
#ENV ADDITIONAL_PYTHON_DEPS=pandas,requests,python-dotenv,numpy,pyarrow,kafka-python,confluent-avro
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY --chown=airflow:root dags/* /opt/airflow/dags/
COPY airflow-user-setup.sh airflow-user-setup.sh 
