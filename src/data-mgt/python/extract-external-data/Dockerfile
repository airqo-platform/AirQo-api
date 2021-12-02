FROM gcr.io/google-appengine/python as builder

RUN apt-get update && apt-get install -y \
  binutils \
  gdal-bin \
  python-gdal \
  libspatialindex-dev

RUN virtualenv /env -p python3.7
# Setting these environment variables are the same as running
# source /env/bin/activate.
ENV VIRTUAL_ENV /env
ENV PATH /env/bin:$PATH

# Copy the source code to app folder
COPY . /app/
# Change the working directory
WORKDIR /app/

# RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
RUN pip install -r requirements.txt

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001
EXPOSE 4001

FROM builder as development
ENV FLASK_ENV=development
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as staging
ENV FLASK_ENV=staging
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as production
ENV FLASK_ENV=production
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as dev-message-broker
ENV FLASK_ENV=development
CMD ["python", "message_broker.py"]

FROM builder as staging-message-broker
ENV FLASK_ENV=staging
CMD ["python", "message_broker.py"]

FROM builder as production-message-broker
ENV FLASK_ENV=production
CMD ["python", "message_broker.py"]