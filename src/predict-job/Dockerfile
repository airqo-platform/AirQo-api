FROM python:3.7-slim as base

RUN apt update
RUN apt install libgomp1

COPY . /app/
WORKDIR /app/

# Install and cache requirements for faster builds
RUN pip install -r requirements.txt

# Production
FROM base as production
ENV ENV=production
CMD ["python", "main.py"]