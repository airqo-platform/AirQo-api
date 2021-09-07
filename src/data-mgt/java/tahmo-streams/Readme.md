# To run tests
```bash
mvn '-Dtest=net.airqo.*Test' test
```
# Build the image
```bash
docker build -t tahmo-values-stream:latest .
````
## M1 chip
```bash
docker build --platform linux/amd64 -t tahmo-values-stream:latest . 
```
# Create and start a container
```bash
docker run --network="host" --rm tahmo-values-stream
```