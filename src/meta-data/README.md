# Metadata microservice

Add the `.env` & `google_application_credentials` files to this directory. 

## To run in a virtual environment

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
flask run
```

## To build and run with docker desktop

```bash
docker build --target=development -t meta-data .
docker run -p 4001:4001 meta-data
```

## Endpoints

Checkout the API documentation for available endpoints.
[extract-data-from-external-sources](https://docs.airqo.net/airqo-platform-api/-Mi1WIQAGi40qdPmLrM7/extract-data-from-external-sources)
