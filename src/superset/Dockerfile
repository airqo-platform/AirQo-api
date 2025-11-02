FROM apache/superset:4.1.2 AS superset

USER root

RUN apt-get update && apt --fix-broken install && apt-get install -y wget unzip

RUN apt-get update && \
    apt-get install -y wget zip libaio1

RUN pip install --default-timeout=100 future && pip install --no-cache  \
    gevent==24.2.1 \
    cryptography==44.0.3 \
    sqlalchemy-bigquery==1.13.0 \
    google-cloud-bigquery==3.31.0 \
    python-graphql-client \
    django-environ==0.12.0 \
    flask-cors

RUN pip install --no-cache gevent psycopg2-binary

WORKDIR /app

COPY docker /app/docker
RUN chmod +x /app/docker/*.sh

# Custom config to use in place of default config
COPY superset_config.py /app/superset_config.py
ENV SUPERSET_CONFIG_PATH=/app/superset_config.py

USER superset
EXPOSE 8088
ENTRYPOINT ["/app/docker/start_superset.sh"]

# Initialization stage
FROM superset as init-superset
USER superset
ENTRYPOINT ["/app/docker/init_superset.sh"]

# Redis image
FROM redis:7.2-bookworm as redis
USER root
CMD ["redis-server"]
