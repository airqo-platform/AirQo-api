resource "google_compute_network_peering" "k8s_to_default" {
  name         = "k8s-to-default"
  network      = google_compute_network.airqo-k8s-cluster.projects/airqo-250220/global/networks/airqo-k8s-cluster
  peer_network = google_compute_network.default.projects/airqo-250220/global/networks/default
}