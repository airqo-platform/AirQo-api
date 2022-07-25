#!/bin/sh
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install ksm prometheus-community/kube-state-metrics --set image.tag=v2.4.2 -n monitoring