FROM python:3.8-slim-buster

COPY / /
WORKDIR /

RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

CMD [ "python", "kcca_batch_insert.py" ]