FROM python:3.7-slim as base

COPY . /app/
WORKDIR /app/

RUN pip install -r requirements.txt

FROM base as airqo-production
ENV ENV=production
CMD ["python", "main.py", "--tenant=airqo"]

FROM base as kcca-production
ENV ENV=production
CMD ["python", "main.py", "--tenant=kcca"]

FROM base as airqo-staging
ENV ENV=staging
CMD ["python", "main.py", "--tenant=airqo"]

FROM base as kcca-staging
ENV ENV=staging
CMD ["python", "main.py", "--tenant=kcca"]