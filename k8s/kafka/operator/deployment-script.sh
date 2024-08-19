#!/bin/bash

kubectl apply -f 'https://strimzi.io/install/latest?namespace=message-broker' -n message-broker
kubectl scale deployment strimzi-cluster-operator --replicas=2 -n message-broker

exit 0
