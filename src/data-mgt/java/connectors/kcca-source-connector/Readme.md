## Source Connector for AirQo device measurements
This connector fetches AirQo devices measurements from the feeds endpoint
### Required configurations for the connector file `stage-airqo-device-measurements-connector.yaml` under `AirQo-api/kafka/connectors` folder
```
pollInterval
average
clarityApiBaseUrl
clarityApiKey
topic
```
### Building the docker image
`docker build -t airqo-stage-kcca-deivce-measurements-connect .`