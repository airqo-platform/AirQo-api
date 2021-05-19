FROM python:3.8-slim-buster
MAINTAINER AirQo "airqo"

ADD requirements.txt /
WORKDIR /

RUN pip install -r requirements.txt
ADD calculate_measurements_by_frequency.py /

ENV DEVICE_REGISTRY_URL=http
ENV FREQUENCY=hourly
ENV START_TIME=hourly

CMD [ "python", "calculate_measurements_by_frequency.py" ]