# Source Connector for Kcca device measurements
This connector fetches Kcca devices measurements from the clarity api
## Required configurations for the connector file `stage-kcca-device-measurements-connector-<average>.yaml` under `AirQo-api/kafka/connectors` folder
```
pollInterval
average // either raw, day or hour
clarityApiBaseUrl
clarityApiKey
topic
```
## Building the docker image
`docker build -t airqo-stage-kcca-deivce-measurements-connect .`