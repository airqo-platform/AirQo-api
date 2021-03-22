Build the image
`docker build -t airqo-batch .`

Create and start a container
`docker run --rm --env DEVICE_REGISTRY_BASE_URL=<device registry base url> airqo-batch`

If you are testing with device registry microservice running locally, include `--network="host"` i.e. `docker run --network="host" --env DEVICE_REGISTRY_BASE_URL=http://localhost:3000/api/v1/ --rm airqo-batch`