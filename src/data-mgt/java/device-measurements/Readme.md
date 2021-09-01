# To run tests
```bash
mvn '-Dtest=net.airqo.*Test' test
```
# Build the image
```bash
docker build -t raw-device-measurements-stream:latest .
````
## M1 chip
```bash
docker build --platform linux/amd64 -t us.gcr.io/airqo-250220/raw-device-measurements-stream:latest . 
```
# Create and start a container
```bash
docker run --network="host" --rm raw-device-measurements-stream
```
