FROM python:3.7-slim as base

RUN apt update
RUN apt install libgomp1

COPY . /app/
WORKDIR /app/

# Install and cache requirements for faster builds
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt


# Development
FROM base as development
ENV ENV=development
CMD ["python", "main.py"]

# Staging
FROM base as staging
ENV ENV=staging
CMD ["python", "main.py"]


# Production
FROM base as production
ENV ENV=production
CMD ["python", "main.py"]