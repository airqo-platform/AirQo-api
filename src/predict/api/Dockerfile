FROM python:3.10.12-slim-bullseye as base

  
COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip --no-cache-dir
RUN pip install -r requirements.txt --no-cache-dir

ENV PYTHONDONWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set environment variables
ENV FLASK_APP=app.py
ENV PORT=5000

EXPOSE 5000

# development
FROM base as dev
ENV FLASK_ENV=development
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]

# staging
FROM base as staging
ENV FLASK_ENV=staging
CMD ["sh", "-c", "gunicorn --bind=0.0.0.0:${PORT:-5000} app:application"]

# production
FROM base as production
ENV FLASK_ENV=production
CMD ["sh", "-c", "gunicorn --bind=0.0.0.0:${PORT:-5000} app:application"]
