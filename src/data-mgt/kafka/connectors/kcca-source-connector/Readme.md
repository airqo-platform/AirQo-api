> To run tests
> `mvn '-Dtest=net.airqo.*Test' test`
>
> Build the jar
> `mvn assembly:assembly -DskipTest`
> 
>Build the image
>`docker build -t localhost:5000/kafka-kcca-deivce-measurements-connect-image .`