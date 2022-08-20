FROM gcr.io/google-appengine/python as builder
ARG PROJECT_DIR=/app-dir

RUN apt-get update && apt-get install -y \
  binutils \
  gdal-bin \
  python-gdal \
  libspatialindex-dev

RUN virtualenv /env -p python3.7
ENV VIRTUAL_ENV /env
ENV PATH /env/bin:$PATH

RUN mkdir $PROJECT_DIR
WORKDIR $PROJECT_DIR

COPY requirements.txt $PROJECT_DIR/
RUN pip install -r requirements.txt

COPY . $PROJECT_DIR/

ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001
EXPOSE 4001

FROM builder as development
ENV FLASK_DEBUG=1
CMD flask run --host=0.0.0.0

FROM builder as deployment
ENV FLASK_DEBUG=0
CMD gunicorn --bind=0.0.0.0:4001 app:app
