
## Running the application
### Using springboot
```bash
./mvnw springboot:run
```
### Using a jar file
```bash
./mvnw package
java -jar target/views-0.0.1-SNAPSHOT.jar
```
## Building a container image
### Using docker
```bash
docker build --platform linux/x86_64 [linux/amd64,linux/arm64] -t view-api --target test .
```
### Using springboot
```bash
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=view-api
```

## Other useful commands
```bash
./mvnw compile
./mvnw package
```
