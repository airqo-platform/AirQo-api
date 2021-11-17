### Build and run with Golang installed on you machine
```bash
go mod tidy
go run .
```

### Build and run using Docker
```bash
docker build -t notification --target=staging --platform=linux .
docker run -p 8080:8080 notification 
```

### Send Welcome Email
#### Make a post request to
```http request
http://localhost:8080/api/v1/notifications/welcomeMessage
```
#### Request Body
```json
{
    "email": "me@myorgnisation.com",
    "firstName": "me",
    "platform": "netmanager"
}
```
_Platform can be either ``mobile`` or ``netmanager``_