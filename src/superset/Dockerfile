FROM python:3.9-slim

RUN apt-get update && \
    apt-get install -y libpq-dev gcc && \
    apt-get install -y build-essential libssl-dev libffi-dev python3-dev python3-pip libsasl2-dev libldap2-dev default-libmysqlclient-dev && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Install dependencies and Superset
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

RUN pip install apache-superset

# Copy the .env file to the Docker image
COPY .env /app/.env

# Load environment variables from the .env file
# RUN set -a && . /app/.env && set +a && echo "SECRET_KEY=${SUPERSET_SECRET_KEY}" 

RUN superset db upgrade

# Create an admin user
RUN superset fab create-admin --username admin --firstname Superset --lastname Admin --email admin@example.com --password adminpassword

RUN superset load_examples
RUN superset init
EXPOSE 8088

CMD ["superset", "run", "-p", "8088", "--with-threads", "--reload", "--debugger"]
