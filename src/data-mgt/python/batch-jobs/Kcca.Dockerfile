FROM python:3.8-slim-buster

COPY / /
WORKDIR /

RUN pip install -r requirements.txt

ENV PYTHONWARNINGS = "ignore:Unverified HTTPS request"

CMD [ "python", "kcca_batch_insert.py" ]