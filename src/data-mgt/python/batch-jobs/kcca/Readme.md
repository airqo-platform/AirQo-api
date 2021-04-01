>Build the image
>`docker build -t kcca-batch .`
>
>[env.kcca.batch file](https://airqo.slack.com/archives/GTHGHCB4G/p1616436451001100)
>
>Create and start a container
>`docker run -d --network="host" --env-file env.kcca.batch --rm kcca-batch`