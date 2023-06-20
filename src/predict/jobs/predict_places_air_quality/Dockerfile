# syntax=docker/dockerfile:1

FROM python:3.9-slim-buster

COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt

CMD ["python", "main.py"]
