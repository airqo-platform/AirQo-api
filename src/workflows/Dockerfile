# The Airflow base image of every stage below; each Airflow upgrade changes only this default.
ARG AIRFLOW_BASE_IMAGE=apache/airflow:2.6.3-python3.10

# Build the airqo_etl_utils wheel (tiny throwaway image)
FROM python:3.10.14-slim-bullseye AS wheel-builder
RUN pip install --upgrade --no-cache-dir setuptools wheel
WORKDIR /build
COPY airqo_etl_utils/ airqo_etl_utils/

#TODO: Update to use the toml script, may requires updated dags to use relative imports
RUN python airqo_etl_utils/setup.py bdist_wheel

# Runtime image: the Airflow base image with the service's packages installed in place.
# Debian bullseye is past its end of life and its packages now live on archive.debian.org.
# The pgdg repository list is removed because its bullseye index no longer exists.
FROM ${AIRFLOW_BASE_IMAGE} AS base
ENV AIRFLOW__CORE__ENABLE_XCOM_PICKLING=true
USER root
RUN rm -f /etc/apt/sources.list.d/pgdg.list && \
    . /etc/os-release && \
    if [ "$VERSION_CODENAME" = "bullseye" ]; then \
        printf 'deb [check-valid-until=no] http://archive.debian.org/debian bullseye main\ndeb [check-valid-until=no] http://archive.debian.org/debian-security bullseye-security main\n' > /etc/apt/sources.list; \
    fi && \
    apt-get update -y && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*
USER airflow

COPY --chown=airflow:root --from=wheel-builder /build/dist/airqo_etl_utils-1.0.0-py3-none-any.whl /home/airflow/
# Every pin ships a binary wheel, so the install needs no compiler.
# apache-airflow is named at the version the base image exports in AIRFLOW_VERSION, so pip resolves
# the wheel's pins against the installed Airflow and the version follows the base image at each hop.
# The Elasticsearch provider is unused by this service; its elasticsearch-dbapi dependency holds
# packaging below 22, which the xarray pin forbids, so both are removed before pip check.
# pip check runs before the Jupyter strip because great-expectations declares notebook and nbformat.
# The Jupyter/notebook ecosystem dragged in by great_expectations 0.18.x serves its Data Docs UI;
# the strip shares this layer with the install, so the removed files never reach the image.
RUN pip install --no-cache-dir \
        "apache-airflow==${AIRFLOW_VERSION}" \
        /home/airflow/airqo_etl_utils-1.0.0-py3-none-any.whl && \
    pip uninstall -y apache-airflow-providers-elasticsearch elasticsearch-dbapi && \
    pip check && \
    { pip uninstall -y \
        notebook jupyterlab jupyterlab-server jupyter-server jupyter-server-terminals \
        jupyter-client jupyter-lsp jupyter-core jupyter-events \
        ipykernel widgetsnbextension jupyterlab-widgets \
        nbconvert nbformat nbclient jupyterlab-pygments notebook-shim \
        debugpy nest-asyncio 2>/dev/null || true; } && \
    rm -f /home/airflow/*.whl

COPY --chown=airflow:root dags/* /opt/airflow/dags/

#TODO: Remove this and use init containers instead
FROM base AS db-setup
USER root
COPY db-setup.sh /usr/local/bin/db-setup.sh
RUN chmod +x /usr/local/bin/db-setup.sh
USER airflow
ENTRYPOINT ["/usr/local/bin/db-setup.sh"]

FROM base AS scheduler
USER airflow
CMD ["airflow", "scheduler"]

FROM base AS webserver
USER airflow
CMD ["airflow", "webserver"]


# As of Airflow 2.7.0, you need to install the celery provider package to use this executor.
# This can be done by installing apache-airflow-providers-celery>=3.3.0 or by installing
# Airflow with the celery extra: pip install 'apache-airflow[celery]'
FROM base AS celery
USER airflow
CMD ["celery", "worker", "--autoscale=6,2"]

FROM base AS deployment
USER airflow

FROM redis:7.2-bookworm as redis
USER root
CMD ["redis-server"]

FROM base AS xcom-setup
USER root
COPY xcom-setup.sh /usr/local/bin/xcom-setup.sh
COPY airflow_xcom/* /usr/local/bin/airflow_xcom/
RUN chmod +x /usr/local/bin/xcom-setup.sh
ENTRYPOINT ["/usr/local/bin/xcom-setup.sh"]
