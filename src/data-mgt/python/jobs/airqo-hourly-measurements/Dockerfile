FROM python:3.8-slim-buster
MAINTAINER AirQo "airqo"

ADD requirements.txt /
WORKDIR /

RUN pip install -r requirements.txt
ADD transform_hourly.py /

ENV DEVICE_REGISTRY_PRODUCTION_URL=http
ENV DEVICE_REGISTRY_STAGING_URL=http

CMD [ "python", "transform_hourly.py" ]