FROM python:3.10.14-slim-bullseye as utils-package
WORKDIR airqo_etl_utils
RUN pip install -U pip setuptools wheel hatch
COPY airqo_etl_utils/* ./
RUN hatch build -t wheel

FROM apache/airflow:2.6.3-python3.10 as base-builder
ENV AIRFLOW_VERSION=2.6.3
#TODO: Update to newer version. Failed due to DB setup stuff
USER root
RUN apt-get update && apt-get install -y gcc git libgomp1
USER airflow

COPY --chown=airflow:root --from=utils-package airqo_etl_utils/dist/airqo_etl_utils-1.0.0-py3-none-any.whl ./
RUN pip install -U pip setuptools wheel
RUN pip install airqo_etl_utils-1.0.0-py3-none-any.whl
COPY --chown=airflow:root dags/* /opt/airflow/dags/

#TODO: Review this whole process. Move to init container approach
FROM base-builder as db-setup
USER root
COPY db-setup.sh /usr/local/bin/db-setup.sh
RUN chmod 777 /usr/local/bin/db-setup.sh
USER airflow
ENTRYPOINT ["/usr/local/bin/db-setup.sh"]

FROM base-builder as scheduler
USER airflow
CMD  [ "airflow",  "scheduler"]

FROM base-builder as webserver
USER airflow
CMD ["airflow", "webserver"]

FROM base-builder as deployment
USER airflow

FROM base-builder as xcom-setup
USER root
COPY xcom-setup.sh /usr/local/bin/xcom-setup.sh
COPY airflow_xcom/* /usr/local/bin/airflow_xcom/
RUN chmod 777 /usr/local/bin/xcom-setup.sh
ENTRYPOINT ["/usr/local/bin/xcom-setup.sh"]

#TODO: review. Perhaps move to organsation artifact repository
FROM noahnsimbe/kafka-docker as kafka-setup
USER root
COPY message-broker-setup.sh /usr/local/bin/message-broker-setup.sh
RUN chmod 777 /usr/local/bin/message-broker-setup.sh
ENTRYPOINT ["/usr/local/bin/message-broker-setup.sh"]
