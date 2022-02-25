FROM python:3 as utils-package
RUN pip install --upgrade pip setuptools wheel
WORKDIR airflow_utils
COPY airflow_utils/* airflow_utils/
RUN python airflow_utils/setup.py bdist_wheel

FROM apache/airflow as base-builder

USER root
RUN apt-get update -y && apt-get install python3-distutils -y && apt-get install python3-apt -y
USER airflow

COPY --from=utils-package airflow_utils/dist/airflow_utils-1.0.0-py3-none-any.whl airflow_utils-1.0.0-py3-none-any.whl
RUN pip install --upgrade pip setuptools wheel
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
RUN pip install airflow_utils-1.0.0-py3-none-any.whl
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

FROM noahnsimbe/kafka-docker as kafka-setup
USER root
COPY message-broker-setup.sh /usr/local/bin/message-broker-setup.sh
RUN chmod 777 /usr/local/bin/message-broker-setup.sh
ENTRYPOINT ["/usr/local/bin/message-broker-setup.sh"]
