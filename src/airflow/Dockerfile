FROM apache/airflow as base-builder
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY --chown=airflow:root dags/* /opt/airflow/dags/

FROM base-builder as dev-db-setup
USER root
RUN apt-get update -y && apt-get install python3-pip -y && pip3 install apache-airflow[postgres]==2.2.3
COPY dev-db-setup.sh /usr/local/bin/dev-db-setup.sh
RUN chmod 777 /usr/local/bin/dev-db-setup.sh
USER airflow
ENTRYPOINT ["/usr/local/bin/dev-db-setup.sh"]

FROM base-builder as dev-scheduler
USER airflow
CMD ["airflow", "scheduler"]

FROM base-builder as dev-webserver
USER airflow
CMD ["airflow", "webserver"]

FROM base-builder as production
USER airflow

FROM base-builder as staging
USER airflow
