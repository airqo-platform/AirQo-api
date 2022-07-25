#!/bin/bash
wget https://github.com/strimzi/strimzi-kafka-operator/releases/download/0.30.0/strimzi-0.30.0.tar.gz
tar -zxvf strimzi-0.30.0.tar.gz
cd  strimzi-0.30.0/
sed -i 's/namespace: .*/namespace: kafka-strimzi/' install/cluster-operator/*RoleBinding*.yaml
kubectl apply -f install/cluster-operator -n kafka-strimzi
kubectl scale deployment strimzi-cluster-operator --replicas=2 -n kafka-strimzi
exit 0
