FROM python:3.8-slim-buster
MAINTAINER Airqo "airqo"

ARG AIRQO_API_BASE_URL
ARG CLARITY_API_BASE_URL
ARG CLARITY_API_KEY
ARG START_DATE_TIME
ARG STOP_DATE_TIME

RUN apt-get update -y && apt-get install -y python3-pip python3-dev

ENV AIRQO_API_BASE_URL=${AIRQO_API_BASE_URL}
ENV CLARITY_API_BASE_URL=${CLARITY_API_BASE_URL}
ENV CLARITY_API_KEY=${CLARITY_API_KEY}
ENV START_DATE_TIME=${START_DATE_TIME}
ENV STOP_DATE_TIME=${STOP_DATE_TIME}

ADD requirements.txt /
WORKDIR /
RUN pip3 install -r requirements.txt
ADD batch_fetch_kcca_data.py /
RUN mkdir /data

ENTRYPOINT [ "python3" ]
CMD [ "-m", "luigi", "--module", "batch_fetch_kcca_data", "ProcessMeasurements", "--local-scheduler" ]
