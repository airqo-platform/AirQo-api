> To run tests
> `mvn '-Dtest=net.airqo.*Test' test`
>
>Build the image
>`docker build -t raw-device-measurements-stream .`
>
>
>Create and start a container
>`docker run --network="host" --rm raw-device-measurements-stream`