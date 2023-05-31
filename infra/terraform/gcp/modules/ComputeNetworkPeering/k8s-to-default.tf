resource "google_compute_network_peering" "k8s_to_default" {
  name         = "k8s-to-default"
  network      = "projects/${var.project_id}/global/networks/airqo-k8s-cluster"
  peer_network = "projects/${var.project_id}/global/networks/default"
}
# terraform import google_compute_network_peering.k8s_to_default ${var.project_id}/airqo-k8s-cluster/default