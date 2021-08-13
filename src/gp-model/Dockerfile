FROM thinkwhere/gdal-python

COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . /app/
WORKDIR /app/

RUN pip install -r requirements.txt

ENV ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=AirQo-e37846081569.json

CMD ["python", "main.py", "--tenant=airqo"]