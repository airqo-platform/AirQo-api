This is a Kafka installation from that packaged by Bitnami [here](https://github.com/bitnami/charts/tree/main/bitnami/kafka) with our custom configurations in [this values.yaml file](values.yaml).

To install the Chart, run:

```yaml
helm install my-release oci://registry-1.docker.io/bitnamicharts/kafka -f values.yaml
```

To uninstall the Chart, run:

```yaml
helm delete my-release
```
