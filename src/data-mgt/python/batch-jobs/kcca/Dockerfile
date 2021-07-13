FROM python:3.8-slim-buster

COPY / /
WORKDIR /

RUN pip install -r requirements.txt

ENTRYPOINT [ "python" ]
CMD [ "batch_fetch.py" ]