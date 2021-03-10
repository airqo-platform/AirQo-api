FROM python:3.8-slim-buster
MAINTAINER Airqo "airqo"

RUN apt-get update -y && apt-get install -y python3-pip python3-dev

ENV AIRQO_API_BASE_URL=${AIRQO_API_BASE_URL}
ENV CLARITY_API_BASE_URL=${CLARITY_API_BASE_URL}
ENV CLARITY_API_KEY=${CLARITY_API_KEY}

COPY requirements.txt /requirements.txt
WORKDIR /
RUN pip3 install -r requirements.txt
COPY . /

ENTRYPOINT [ "python3" ]
CMD [ "-m", "luigi", "--module", "batch_fetch_kcca_data", "UpdateCollections", "--local-scheduler" ]
