#!/bin/bash
kubectl apply -f namespace.yaml
wget https://github.com/strimzi/strimzi-kafka-operator/releases/download/0.29.0/strimzi-0.29.0.tar.gz
tar -zxvf strimzi-0.29.0.tar.gz
cd  strimzi-0.29.0/
sed -i 's/namespace: .*/namespace: kafka-strimzi/' install/cluster-operator/*RoleBinding*.yaml
kubectl apply -f install/cluster-operator -n kafka-strimzi
kubectl scale deployment strimzi-cluster-operator-3.2.0 --replicas=2
exit 0
