> To run tests
> `mvn '-Dtest=net.airqo.*Test' test`
>
>Build the image
>`docker build -t kafka-kcca-measurements-stream .`
>
>
>Create and start a container
>`docker run --network="host" --rm kafka-kcca-measurements-stream`