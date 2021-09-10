FROM gcr.io/google-appengine/python

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

RUN pip install -r requirements.txt
# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV FLASK_RUN_PORT=4001

EXPOSE 4001

CMD ["flask", "run", "--host=0.0.0.0"]
