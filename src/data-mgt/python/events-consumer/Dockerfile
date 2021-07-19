FROM python:3.9-slim-buster

COPY / /
WORKDIR /

RUN pip install -r requirements.txt

ENV PYTHONWARNINGS = "ignore:Unverified HTTPS request"

CMD [ "python", "measurements_consumer.py" ]