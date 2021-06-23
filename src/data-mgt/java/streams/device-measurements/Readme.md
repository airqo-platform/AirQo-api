> To run tests
> `mvn '-Dtest=net.airqo.*Test' test`
>
>Build the image
>`docker build -t device-measurements-stream .`
>
>
>Create and start a container
>`docker run --network="host" --rm device-measurements-stream`