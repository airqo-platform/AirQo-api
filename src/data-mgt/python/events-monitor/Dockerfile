FROM python:3.8-slim-buster

COPY requirements.txt /
COPY main.py /

WORKDIR /
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

CMD [ "python", "main.py" ]