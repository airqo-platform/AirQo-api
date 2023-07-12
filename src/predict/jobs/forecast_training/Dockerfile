FROM python:3.9-slim as base

RUN apt-get update -y && apt-get install -y gcc && apt-get install -y git
RUN apt install libgomp1

COPY . /app/
WORKDIR /app/

# Install and cache requirements for faster builds
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Production
FROM base as production
ENV ENV=production
CMD ["sh", "run_scripts.sh"]


# Staging
FROM base as staging
ENV ENV=staging
CMD ["sh", "run_scripts.sh"]

# development
FROM base as development
ENV ENV=development
CMD ["sh", "run_scripts.sh"]
