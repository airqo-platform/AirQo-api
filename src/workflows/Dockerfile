FROM python:3.10.14-slim-bullseye as utils-package
RUN pip install --upgrade pip setuptools wheel
WORKDIR airqo_etl_utils
COPY airqo_etl_utils/* airqo_etl_utils/

#TODO: Update to use the toml script, may requires updated dags to use relative imports
RUN python airqo_etl_utils/setup.py bdist_wheel


FROM apache/airflow:2.6.3-python3.10 as base-builder
ENV AIRFLOW_VERSION=2.6.3
ENV AIRFLOW__CORE__ENABLE_XCOM_PICKLING=true
USER root
RUN apt-get update -y && apt-get install python3-distutils -y && apt-get install python3-apt -y
RUN apt-get install -y gcc && apt-get install -y git && apt-get install libgomp1
USER airflow

COPY --from=utils-package airqo_etl_utils/dist/airqo_etl_utils-1.0.0-py3-none-any.whl airqo_etl_utils-1.0.0-py3-none-any.whl
RUN pip install --upgrade pip setuptools wheel
RUN pip install airqo_etl_utils-1.0.0-py3-none-any.whl
COPY --chown=airflow:root dags/* /opt/airflow/dags/

#TODO: Remove this and use init containers instead
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

#TODO: move to organisation registry
FROM noahnsimbe/kafka-docker as kafka-setup
USER root
COPY message-broker-setup.sh /usr/local/bin/message-broker-setup.sh
RUN chmod 777 /usr/local/bin/message-broker-setup.sh
ENTRYPOINT ["/usr/local/bin/message-broker-setup.sh"]
