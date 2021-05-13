> To run tests
> `mvn '-Dtest=net.airqo.*Test' test`
>
> Build the jar
> `mvn assembly:assembly -DskipTest`
> 
>Build the image
>`docker build -t localhost:49155/airqo-stage-kcca-deivce-measurements-connect .`