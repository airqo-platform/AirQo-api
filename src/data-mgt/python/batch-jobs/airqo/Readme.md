Add [Add the Google Credentials file](https://airqo.slack.com/archives/GTHGHCB4G/p1616442599002000) to this directory add rename it to `bigquery.json`

Build the image
`docker build -t airqo-batch .`

Create and start a container
`docker run --rm --env DEVICE_REGISTRY_BASE_URL=<device registry base url> airqo-batch`

If you are testing with the device registry microservice running locally, include `--network="host"` i.e. `docker run --network="host" --env DEVICE_REGISTRY_BASE_URL=http://localhost:3000/api/v1/ --rm airqo-batch`