FROM python:3.7-slim as base

RUN apt update
RUN apt install -y libgomp1

COPY . /app/
WORKDIR /app/

# Install and cache requirements for faster builds
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Production
FROM base as production
ENV ENV=production
CMD ["python", "main.py"]

# Staging
FROM base as staging
ENV ENV=staging
CMD ["python", "main.py"]

# development
FROM base as development
ENV ENV=development

CMD ["python", "main.py"]
