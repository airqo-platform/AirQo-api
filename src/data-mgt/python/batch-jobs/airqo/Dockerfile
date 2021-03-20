FROM python:3.8-slim-buster
MAINTAINER Airqo "airqo"

ARG AIRQO_API_BASE_URL
ARG GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE

RUN apt-get update -y && apt-get install -y python3-pip python3-dev

ENV AIRQO_API_BASE_URL=${AIRQO_API_BASE_URL}
ENV GOOGLE_APPLICATION_CREDENTIALS=${GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE}

ADD requirements.txt /
WORKDIR /
RUN pip3 install -r requirements.txt
COPY batch_fetch_airqo_data.py /
ADD ./${GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE} /
RUN mkdir /data

ENTRYPOINT [ "python3" ]
CMD [ "-m", "luigi", "--module", "batch_fetch_airqo_data", "GetDeviceMeasurements", "--local-scheduler" ]
