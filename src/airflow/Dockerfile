FROM apache/airflow as base-builder
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY --chown=airflow:root dags/* /opt/airflow/dags/

FROM base-builder as db-setup
USER root
RUN apt-get update -y && apt-get install python3-pip -y && pip3 install apache-airflow[postgres]==2.2.3
COPY db-setup.sh /usr/local/bin/db-setup.sh
RUN chmod 777 /usr/local/bin/db-setup.sh
USER airflow
ENTRYPOINT ["/usr/local/bin/db-setup.sh"]

FROM base-builder as scheduler
USER airflow
CMD ["airflow", "scheduler"]

FROM base-builder as webserver
USER airflow
CMD ["airflow", "webserver"]

FROM base-builder as production
USER airflow

FROM base-builder as staging
USER airflow
