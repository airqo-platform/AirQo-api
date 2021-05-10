> Computes and stores the average hourly, daily or minute values for today's airqo device measurements
> 
>Valid FREQUENCY values are hourly, daily and minute
> 
>Build the image
>`docker build -t airqo-measurements-frequency-job .`
>
>Create and start a container
>`docker run --network="host" --rm airqo-measurements-frequency-job`