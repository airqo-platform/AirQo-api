FROM python:3.7-slim

RUN apt-get update && apt-get install -y \
  binutils \
  gdal-bin \
  python-gdal \
  libspatialindex-dev

COPY . /app/
WORKDIR /app/

RUN pip install -r requirements.txt

ENV ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=AirQo-e37846081569.json

CMD ["python", "main.py", "--tenant=airqo"]