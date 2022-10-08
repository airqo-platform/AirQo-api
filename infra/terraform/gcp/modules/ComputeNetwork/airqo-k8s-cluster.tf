resource "google_compute_network" "airqo_k8s_cluster" {
  auto_create_subnetworks = false
  name                    = "airqo-k8s-cluster"
  project                 = "${var.project-id}"
  routing_mode            = "REGIONAL"
}
# terraform import google_compute_network.airqo_k8s_cluster projects/airqo-250220/global/networks/airqo-k8s-cluster
