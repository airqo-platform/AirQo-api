# Build the airqo_etl_utils wheel (tiny throwaway image)
FROM python:3.10.14-slim-bullseye AS wheel-builder
RUN pip install --upgrade --no-cache-dir setuptools wheel
WORKDIR /build
COPY airqo_etl_utils/ airqo_etl_utils/

#TODO: Update to use the toml script, may requires updated dags to use relative imports
RUN python airqo_etl_utils/setup.py bdist_wheel

# Install all Python deps (needs gcc / git for C-extension builds)
FROM apache/airflow:2.6.3-python3.10 AS deps-builder
USER root
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
    gcc \
    git \
    libgomp1 && \
    rm -rf /var/lib/apt/lists/*
USER airflow

COPY --chown=airflow:root --from=wheel-builder /build/dist/airqo_etl_utils-1.0.0-py3-none-any.whl /home/airflow/
# Pin apache-airflow to its installed version to stop pip backtracking across all airflow releases.
# Providers (google, celery) are already present in the base image — only GE provider needs adding.
RUN printf 'apache-airflow==2.6.3\n' > /home/airflow/pin.txt && \
    pip install --no-cache-dir \
        --constraint /home/airflow/pin.txt \
        /home/airflow/airqo_etl_utils-1.0.0-py3-none-any.whl \
        "airflow-provider-great-expectations==0.2.8" && \
    rm -f /home/airflow/*.whl /home/airflow/pin.txt

# Strip Jupyter/notebook ecosystem dragged in by great_expectations 0.18.x.
# These are Data Docs UI tools — not needed in an Airflow runtime environment.
RUN python -m pip uninstall -y \
        notebook jupyterlab jupyterlab-server jupyter-server jupyter-server-terminals \
        jupyter-client jupyter-lsp jupyter-core jupyter-events \
        ipykernel widgetsnbextension jupyterlab-widgets \
        nbconvert nbformat nbclient jupyterlab-pygments notebook-shim \
        debugpy nest-asyncio  2>/dev/null || true


# Clean runtime base (NO build tools — only runtime libs)
FROM apache/airflow:2.6.3-python3.10 AS base
ENV AIRFLOW__CORE__ENABLE_XCOM_PICKLING=true
USER root
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*
USER airflow

# Copy only the installed packages from the builder
COPY --from=deps-builder /home/airflow/.local /home/airflow/.local
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
