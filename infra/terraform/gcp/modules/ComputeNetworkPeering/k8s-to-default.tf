resource "google_compute_network_peering" "k8s_to_default" {
  name         = "k8s-to-default"
  network      = "projects/airqo-250220/global/networks/airqo-k8s-cluster"
  peer_network = "projects/airqo-250220/global/networks/default"
}