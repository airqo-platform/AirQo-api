FROM python:3.8-slim-buster
MAINTAINER Airqo "airqo"

ADD requirements.txt /
WORKDIR /

RUN pip install -r requirements.txt
ADD batch_fetch_kcca_data.py /
RUN mkdir /data

ENTRYPOINT [ "python" ]
CMD [ "-m", "luigi", "--module", "batch_fetch_kcca_data", "TransformMeasurements" ]
