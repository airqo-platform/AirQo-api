resource "google_compute_network_peering" "default_to_k8s" {
  name         = "default-to-k8s"
  network      = google_compute_network.default.projects/airqo-250220/global/networks/default
  peer_network = google_compute_network.airqo-k8s-cluster.projects/airqo-250220/global/networks/airqo-k8s-cluster
}