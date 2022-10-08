resource "google_compute_network" "airqo_k8s_cluster" {
  auto_create_subnetworks = false
  name                    = "airqo-k8s-cluster"
  project                 = var.project-id
  routing_mode            = "REGIONAL"
}
# terraform import google_compute_network.airqo_k8s_cluster projects/${var.project-id}/global/networks/airqo-k8s-cluster
