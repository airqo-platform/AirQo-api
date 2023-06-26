This nginx installation uses the [nginxinc/kubernetes-ingress](https://github.com/nginxinc/kubernetes-ingress) helm chart [here](https://github.com/nginxinc/kubernetes-ingress/tree/main/deployments/helm-chart).

To install, you'll need to install the crds as described [here](https://github.com/nginxinc/kubernetes-ingress/tree/main/deployments/helm-chart#upgrading-the-crds), run the command below to install with the configurations specified in the values.yaml file.

```bash
helm install my-release oci://ghcr.io/nginxinc/charts/nginx-ingress -f values.yaml -n nginx-ingress
```
