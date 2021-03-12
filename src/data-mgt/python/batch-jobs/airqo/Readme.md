`docker build -t airqo-batch --build-arg AIRQO_API_BASE_URL=<airqo base url> --build-arg FEEDS_BASE_URL=<feeds base url> --build-arg GOOGLE_APPLICATION_CREDENTIALS_JSON_FILE=<bigquery service account file>.json  .`

`docker run --rm airqo-batch`

On localhost include : `--network="host"`