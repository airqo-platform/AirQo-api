FROM python:3.8-slim-buster as builder
COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip setuptools wheel
RUN pip install -r requirements.txt
ENV FLASK_APP=app.py
ENV FLASK_RUN_PORT=4001
EXPOSE 4001

FROM builder as production
ENV FLASK_ENV=production
CMD ["gunicorn", "--bind=0.0.0.0:4001", "app:app"]

FROM builder as staging
ENV FLASK_ENV=staging
CMD ["gunicorn", "--bind=0.0.0.0:4001", "app:app"]

FROM builder as dev
ENV FLASK_ENV=development
CMD ["flask", "run", "--host=0.0.0.0"]

FROM builder as train-lstm-model
CMD ["python", "jobs/train_lstm_model.py"]

FROM builder as train-catboost-model
CMD ["python", "jobs/train_catboost_model.py"]
