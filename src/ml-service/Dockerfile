# file used to launch the docker container

FROM python:3.7.3
ADD . /usr/src/app
WORKDIR /usr/src/app
EXPOSE 4000
RUN pip install --upgrade pip
RUN pip install -r requirements/common.txt
ENTRYPOINT ["python","run.py"]