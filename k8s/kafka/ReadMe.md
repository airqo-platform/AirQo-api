# Kafka Setup and Deployment...

Kafka is deployed using Strimzi, documentation [here](https://strimzi.io/docs/operators/latest/deploying#deploying-kafka-cluster-kraft-str)

Please follow these steps to deploy Kafka in our cluster

1. Run the deployment-script.sh to deploy the operator, modify the version as needed.
2. Run `Kubectl apply -f kafka-cluster-stage.yaml` to deploy the rest of the resources.
