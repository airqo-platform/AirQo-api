> Add the [Google Credentials file](https://airqo.slack.com/archives/GTHGHCB4G/p1616442599002000) to this directory and rename it to `bigquery.json`
>
> Build the image
> `docker build -t airqo-batch .`
>
> [env.airqo.batch file](https://airqo.slack.com/archives/GTHGHCB4G/p1616436451001100)
>
> Create and start a container
>`docker run -d --network="host" --env-file env.airqo.batch --rm airqo-batch`
