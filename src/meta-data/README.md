# Metadata microservice.

Prerequisites
Add the `.env` & `google_application_credentials.json` files to this directory. Both files can be obtained from the DevOps engineer.

## To run in a virtual environment

```bash
python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```
## To run the API
```bash
flask run
```

## To run the Message broker connector.

```bash
python message-broker.py --target=sites-consumer
```

## To build and run with docker 

```bash
docker build --target=development -t meta-data .
docker run -p 4001:4001 meta-data
```

## To build and run with docker compose

```bash
bash run-docker-compose.sh
```

## Endpoints

Checkout the API documentation for available endpoints.
```http
http://localhost:4001/api/v1/meta-data/apidocs/
```

