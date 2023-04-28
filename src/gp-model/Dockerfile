FROM python:3.7-slim as base

COPY . /app/
WORKDIR /app/

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

ENV PYTHONDONWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# production 
FROM base as production 
ENV ENV=production
CMD ["python", "main.py", "--tenant=airqo"]

# staing 
FROM base as staging 
ENV ENV=staging
CMD ["python", "main.py", "--tenant=airqo"]

# development 
FROM base as dev
ENV ENV=development
CMD ["python", "main.py", "--tenant=airqo"]

FROM base as message-broker-consumers
CMD ["python", "message-broker.py"]
