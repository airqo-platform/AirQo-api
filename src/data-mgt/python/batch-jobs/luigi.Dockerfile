FROM python:3.8-slim-buster
MAINTAINER Airqo "airqo"

RUN pip install luigi

CMD /bin/bash -c "luigid --background --port 8082"
