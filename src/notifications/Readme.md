### Build and run with Golang installed on you machine
Add a .env file to the `config` folder ([.env file](https://docs.google.com/document/d/1JEC9D6zE1c8910kloGOwiOtPayS8PXEEXbFEgJl4vZc/edit?usp=sharing))
```bash
go mod tidy
go run .
```

### Build and run using Docker
Add a .env file to the `config` folder ([.env file](https://docs.google.com/document/d/1JEC9D6zE1c8910kloGOwiOtPayS8PXEEXbFEgJl4vZc/edit?usp=sharing))
```bash
docker build -t notification --target staging --platform linux/x86_64 .
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