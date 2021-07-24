FROM python:3.8-slim-buster

COPY . /app/

WORKDIR /app/

RUN --mount=type=cache, target=/root/.cache pip install -r requirements.txt

ENV PYTHONWARNINGS = "ignore:Unverified HTTPS request"

CMD [ "python", "main.py" ]
