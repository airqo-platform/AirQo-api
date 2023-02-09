FROM python:3.7-slim as base

COPY . /app/
WORKDIR /app/

RUN pip install -r requirements.txt

FROM base as production
ENV ENV=production
CMD ["python", "main.py", "--tenant=airqo"]

FROM base as staging
ENV ENV=staging
CMD ["python", "main.py", "--tenant=airqo"]
