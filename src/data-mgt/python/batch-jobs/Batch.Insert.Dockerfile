FROM python:3.8-slim-buster

COPY / /
WORKDIR /

RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

CMD [ "python", "batch_insert_main.py" ]
