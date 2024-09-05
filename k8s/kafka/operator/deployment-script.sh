#!/bin/bash
wget https://github.com/strimzi/strimzi-kafka-operator/releases/download/0.42.0/strimzi-0.42.0.tar.gz
tar -zxvf strimzi-0.42.0.tar.gz
cd  strimzi-0.42.0/
sed -i 's/namespace: .*/namespace: message-broker/' install/cluster-operator/*RoleBinding*.yaml
kubectl apply -f install/cluster-operator -n message-broker
kubectl scale deployment strimzi-cluster-operator --replicas=2 -n message-broker
exit 0
