FROM python:3.7-slim as base

COPY . /app/
WORKDIR /app/

RUN pip install pip --upgrade
RUN pip install -r requirements.txt

ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001

EXPOSE 4001

FROM base as dev
ENV FLASK_ENV=development

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM base as staging
ENV FLASK_ENV=staging

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]

FROM base as production
ENV FLASK_ENV=production

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]
