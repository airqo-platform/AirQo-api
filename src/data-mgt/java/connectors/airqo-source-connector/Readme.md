## Source Connector for AirQo device measurements
This connector fetches AirQo devices measurements from the feeds endpoint
### Required configurations for the connector file `stage-airqo-device-measurements-connector.yaml` under `AirQo-api/kafka/connectors` folder
```
topic
pollInterval
airqoBaseUrl
feedsBaseUrl
```
### Building the docker image
`docker build -t stage-airqo-deivce-measurements-connect .`
