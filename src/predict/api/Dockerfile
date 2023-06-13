FROM python:3.9.17-slim-bullseye as base

  
COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip --no-cache-dir
RUN pip install -r requirements.txt --no-cache-dir

ENV PYTHONDONWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set environment variables
ENV FLASK_APP=app.py


EXPOSE 5000

# production 
FROM base as production 
ENV FLASK_ENV=production
CMD ["gunicorn", "--bind=0.0.0.0:5000", "app:application"]

# staging
FROM base as staging 
ENV FLASK_ENV=staging
CMD ["gunicorn", "--bind=0.0.0.0:5000", "app:application"]

# development
FROM base as dev
ENV FLASK_ENV=development
CMD ["flask", "run", "--host=0.0.0.0"]
