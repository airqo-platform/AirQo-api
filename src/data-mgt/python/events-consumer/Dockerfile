FROM python:3.8-slim-buster

COPY . /app/

WORKDIR /app/

RUN pip install -r requirements.txt

ENV PYTHONWARNINGS = "ignore:Unverified HTTPS request"

CMD [ "python", "measurements_consumer.py" ]
