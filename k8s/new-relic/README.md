1. Run this command on your host to install Kubernetes integration.

KSM_IMAGE_VERSION="v2.13.0" && helm repo add newrelic https://helm-charts.newrelic.com && helm repo update && kubectl create namespace newrelic-monitoring ; helm upgrade --install newrelic-bundle newrelic/nri-bundle --set global.licenseKey=<<LICENSE KEY>> --set global.cluster=staging --namespace=newrelic-monitoring --set newrelic-infrastructure.privileged=true --set global.lowDataMode=true --set kube-state-metrics.image.tag=${KSM_IMAGE_VERSION} --set kube-state-metrics.enabled=true --set kubeEvents.enabled=true --set newrelic-prometheus-agent.enabled=true --set newrelic-prometheus-agent.lowDataMode=true --set newrelic-prometheus-agent.config.kubernetes.integrations_filter.enabled=false --set k8s-agents-operator.enabled=true --set logging.enabled=true --set newrelic-logging.lowDataMode=true

2. Update the values file with any required configurations.
3. Upgrade the newrelic-bundle helm release using the values file.

helm repo add newrelic https://helm-charts.newrelic.com && helm repo update; helm upgrade --install newrelic-bundle newrelic/nri-bundle -n newrelic-monitoring --values values.yaml

4. Run this command to enable APM auto-instrumentation using the instrumentation file.

kubectl apply -f ./instrumentation.yaml -n newrelic-monitoring
