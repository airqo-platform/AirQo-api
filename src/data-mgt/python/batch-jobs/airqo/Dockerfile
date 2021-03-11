FROM python:3.8-slim-buster
MAINTAINER Airqo "airqo"

ARG AIRQO_API_BASE_URL
ARG FEEDS_BASE_URL
ARG GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE

RUN apt-get update -y && apt-get install -y python3-pip python3-dev

ENV AIRQO_API_BASE_URL=${AIRQO_API_BASE_URL}
ENV FEEDS_BASE_URL=${FEEDS_BASE_URL}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE}

COPY requirements.txt /requirements.txt
WORKDIR /
RUN pip3 install -r requirements.txt
COPY . /

ENTRYPOINT [ "python3" ]
CMD [ "-m", "luigi", "--module", "batch_fetch_airqo_data", "GetDeviceMeasurements", "--local-scheduler" ]
