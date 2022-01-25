# Inherit from the Python Docker image
FROM python:3.7-slim as base

  
COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

ENV PYTHONDONWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set environment variables
ENV FLASK_APP=app.py
ENV GOOGLE_APPLICATION_CREDENTIALS=AirQo-e37846081569.json

EXPOSE 5000

# production 
FROM base as production 
ENV FLASK_ENV=production

CMD ["flask", "run", "--host=0.0.0.0"]

# production 
FROM base as staging 
ENV FLASK_ENV=staging

CMD ["flask", "run", "--host=0.0.0.0"]

# production 
FROM base as dev
ENV FLASK_ENV=development

CMD ["flask", "run", "--host=0.0.0.0"]