This falco and falcosidekick installation uses the [falcosecurity/charts](https://github.com/falcosecurity/charts) helm chart [here](https://github.com/falcosecurity/charts/tree/master/falco).

Before installing the chart, add the falcosecurity charts repository:

```bash
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update
```

To install the chart with the configurations specified in the values.yaml file, run the command below:

```bash
helm install my-release falcosecurity/falco -f values.yaml -n security
```
