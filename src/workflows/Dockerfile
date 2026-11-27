# The Airflow base image of every stage below; each Airflow upgrade changes only this default.
ARG AIRFLOW_BASE_IMAGE=apache/airflow:slim-3.3.2-python3.10

# Build the airqo_etl_utils wheel (tiny throwaway image)
FROM python:3.10.14-slim-bullseye AS wheel-builder
RUN pip install --upgrade --no-cache-dir setuptools wheel
WORKDIR /build
COPY airqo_etl_utils/ airqo_etl_utils/

#TODO: Update to use the toml script, may requires updated dags to use relative imports
RUN python airqo_etl_utils/setup.py bdist_wheel

# Runtime image: the slim Airflow base image with the service's packages installed in place.
# lightgbm needs the OpenMP runtime, which the slim image leaves out.
FROM ${AIRFLOW_BASE_IMAGE} AS base
USER root
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*
USER airflow

COPY --chown=airflow:root --from=wheel-builder /build/dist/airqo_etl_utils-1.0.0-py3-none-any.whl /home/airflow/
COPY --chown=airflow:root google_provider_only_packages.py /home/airflow/
# The slim base image ships Airflow without providers. The constraints file of the base image's Airflow
# release and Python version pins both installs below, with the entries for the packages the service
# wheel pins itself removed, so the service's versions apply and every other package stays at the
# version Airflow was tested with. The first install adds the executor with its broker client (celery),
# the metadata database driver (postgres), Sentry, the Slack provider the code imports, the Google
# provider of the remote task-log handler and the FAB provider of the login. The second install adds
# the service wheel. Every pin ships a binary wheel, so the install needs no compiler.
# After pip check, the Great Expectations modules the service uses are imported.
# The Google provider is installed for the Cloud Storage task-log handler only. The packages that
# only the provider requires are then removed in this layer, apart from the clients the handler
# imports, and the handler is built to confirm that it still loads.
RUN PYTHON_MAJOR_MINOR="$(python -c 'import sys; print(sys.version_info[0], sys.version_info[1], sep=chr(46))')" && \
    curl -fsSL "https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_MAJOR_MINOR}.txt" -o /tmp/constraints-airflow.txt && \
    python -c 'import re, sys, zipfile; wheel = zipfile.ZipFile(sys.argv[1]); metadata = wheel.read(next(name for name in wheel.namelist() if name.endswith("/METADATA"))).decode(); normalise = lambda name: re.sub(r"[-_.]+", "-", name).lower(); pinned = {normalise(name) for name in re.findall(r"^Requires-Dist: *([A-Za-z0-9][A-Za-z0-9._-]*)", metadata, re.M)}; sys.stdout.writelines(line for line in open(sys.argv[2]) if normalise(line.split("==")[0]) not in pinned)' \
        /home/airflow/airqo_etl_utils-1.0.0-py3-none-any.whl /tmp/constraints-airflow.txt > /tmp/constraints.txt && \
    pip install --no-cache-dir --constraint /tmp/constraints.txt \
        "apache-airflow[celery,postgres,sentry]==${AIRFLOW_VERSION}" \
        apache-airflow-providers-slack \
        apache-airflow-providers-google \
        apache-airflow-providers-fab && \
    pip install --no-cache-dir --constraint /tmp/constraints.txt /home/airflow/airqo_etl_utils-1.0.0-py3-none-any.whl && \
    pip check && \
    python -B -c "import great_expectations.checkpoint, great_expectations.datasource.fluent, great_expectations.expectations.expectation_configuration" && \
    GOOGLE_PROVIDER_ONLY="$(python -B /home/airflow/google_provider_only_packages.py \
        --requested "apache-airflow[celery,postgres,sentry]" apache-airflow-providers-slack \
            apache-airflow-providers-fab airqo-etl-utils pip \
        --keep gcloud-aio-auth gcloud-aio-bigquery gcloud-aio-storage \
            google-cloud-secret-manager google-cloud-storage)" && \
    pip uninstall -y ${GOOGLE_PROVIDER_ONLY} && \
    python -B -c "from airflow.providers.google.cloud.log.gcs_task_handler import GCSTaskHandler; GCSTaskHandler(base_log_folder='/tmp/gcs-task-handler-check', gcs_log_folder='gs://bucket/logs')" && \
    rm -rf /home/airflow/*.whl /home/airflow/google_provider_only_packages.py /tmp/gcs-task-handler-check

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

FROM base AS api-server
USER airflow
CMD ["airflow", "api-server"]

# Parses the DAG folder.
FROM base AS dag-processor
USER airflow
CMD ["airflow", "dag-processor"]


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
