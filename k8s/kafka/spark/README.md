This nginx installation uses the [bitnami/charts](https://github.com/bitnami/charts/tree/main/bitnami/spark) helm chart [here](https://github.com/bitnami/charts/tree/main/bitnami/spark).

Run the command below to install with the configurations specified in the values.yaml file.

```bash
helm install my-release oci://registry-1.docker.io/bitnamicharts/spark -f values.yaml
```

To upgrade, run:

```bash
helm upgrade my-release oci://registry-1.docker.io/bitnamicharts/spark -f values.yaml
```
