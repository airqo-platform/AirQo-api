Build the image
`docker build -t kcca-batch .`

[env.kcca.batch file](https://airqo.slack.com/archives/GTHGHCB4G/p1616436451001100)

Create and start a container
`docker run --rm --env-file env.kcca.batch kcca-batch`

If you are testing with device registry microservice running locally, include `--network="host"` i.e. `docker run --network="host" --env-file env.kcca.batch --rm kcca-batch`