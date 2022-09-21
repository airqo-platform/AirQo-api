resource "google_compute_network" "pipeline_k8s_cluster" {
  auto_create_subnetworks = true
  mtu                     = 1460
  name                    = "pipeline-k8s-cluster"
  project                 = "airqo-250220"
  routing_mode            = "REGIONAL"
}
# terraform import google_compute_network.pipeline_k8s_cluster projects/airqo-250220/global/networks/pipeline-k8s-cluster
