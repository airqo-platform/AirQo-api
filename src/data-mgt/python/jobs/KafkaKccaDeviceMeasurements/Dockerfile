FROM python:3.8-slim-buster

ADD requirements.txt /
WORKDIR /

RUN pip install -r requirements.txt
ADD kcca_device_measurements.py /
ADD .env /

CMD [ "python", "kcca_device_measurements.py" ]