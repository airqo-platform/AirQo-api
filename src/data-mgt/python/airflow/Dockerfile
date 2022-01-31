FROM apache/airflow
#USER root
#RUN apt-get update \
#  && apt-get install python3-distutils -y
#USER airflow
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY --chown=airflow:root dags/* /opt/airflow/dags/
COPY airflow-user-setup.sh airflow-user-setup.sh 
