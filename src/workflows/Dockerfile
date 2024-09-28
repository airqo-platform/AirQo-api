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
RUN apt-get update -y && \
    apt-get install -y \
    python3-distutils \
    python3-apt \
    gcc \
    git \
    libgomp1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

USER airflow

COPY --from=utils-package airqo_etl_utils/dist/airqo_etl_utils-1.0.0-py3-none-any.whl airqo_etl_utils-1.0.0-py3-none-any.whl

RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir airqo_etl_utils-1.0.0-py3-none-any.whl

COPY --chown=airflow:root dags/* /opt/airflow/dags/

#TODO: Remove this and use init containers instead
FROM base-builder as db-setup
USER root
COPY db-setup.sh /usr/local/bin/db-setup.sh
RUN chmod +x /usr/local/bin/db-setup.sh
USER airflow
ENTRYPOINT ["/usr/local/bin/db-setup.sh"]

FROM base-builder as scheduler
USER airflow
CMD  [ "airflow",  "scheduler"]

FROM base-builder as webserver
USER airflow
CMD ["airflow", "webserver"]


# As of Airflow 2.7.0, you need to install the celery provider package to use this executor.
# This can be done by installing apache-airflow-providers-celery>=3.3.0 or by installing 
# Airflow with the celery extra: pip install 'apache-airflow[celery]'
FROM base-builder as celery
USER airflow
CMD ["celery", "worker", "--autoscale=6,2"]

FROM base-builder as deployment
USER airflow

FROM redis:7.2-bookworm as redis
USER root
CMD ["redis-server"]

FROM base-builder as xcom-setup
USER root
COPY xcom-setup.sh /usr/local/bin/xcom-setup.sh
COPY airflow_xcom/* /usr/local/bin/airflow_xcom/
RUN chmod +x /usr/local/bin/xcom-setup.sh
ENTRYPOINT ["/usr/local/bin/xcom-setup.sh"]

# TODO: move to organisation registry
FROM noahnsimbe/kafka-docker as kafka-setup
USER root
COPY message-broker-setup.sh /usr/local/bin/message-broker-setup.sh
RUN chmod +x /usr/local/bin/message-broker-setup.sh
ENTRYPOINT ["/usr/local/bin/message-broker-setup.sh"]
