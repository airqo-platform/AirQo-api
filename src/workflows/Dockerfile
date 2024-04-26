FROM python:3.10.14-slim-bullseye as utils-package
RUN pip install -U pip setuptools wheel hatch
WORKDIR airqo_etl_utils
COPY airqo_etl_utils/* airqo_etl_utils/
RUN hatch build -t wheel

FROM apache/airflow:2.9.0-python3.10 as base-builder
ENV AIRFLOW_VERSION=2.9.0
USER root
RUN apt-get update && apt-get install -y gcc git libgomp1
USER airflow

COPY --from=utils-package airqo_etl_utils/dist/airqo_etl_utils-1.0.0-py3-none-any.whl .
RUN pip install --U setuptools pip wheel
RUN pip install airqo_etl_utils-1.0.0-py3-none-any.whl
COPY --chown=airflow:root dags/* /opt/airflow/dags/

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

#TODO: Review this, perhaps migrate to organisation hub
FROM noahnsimbe/kafka-docker as kafka-setup
USER root
COPY message-broker-setup.sh /usr/local/bin/message-broker-setup.sh
RUN chmod 777 /usr/local/bin/message-broker-setup.sh
ENTRYPOINT ["/usr/local/bin/message-broker-setup.sh"]
