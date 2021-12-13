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

# run application
CMD ["python", "main.py", "--tenant=airqo"]

# production 
FROM base as staging 
ENV ENV=staging

# run application
CMD ["python", "main.py", "--tenant=airqo"]

# production 
FROM base as dev
ENV ENV=development

# run application
CMD ["python", "main.py", "--tenant=airqo"]