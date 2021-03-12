`docker build -t kcca-batch --build-arg AIRQO_API_BASE_URL=<airqo base url> --build-arg CLARITY_API_BASE_URL=<clarity base url> --build-arg CLARITY_API_KEY=<api key> --build-arg START_DATE_TIME=<start date (yyyy-MM-ddTHH:mm:ssZ)> --build-arg STOP_DATE_TIME=<stop date (yyyy-MM-ddTHH:mm:ssZ) .`

`docker run --rm kcca-batch`

On localhost include : `--network="host"`