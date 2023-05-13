resource "google_compute_network_peering" "default_to_k8s" {
  name         = "default-to-k8s"
  network      = "projects/${var.project_id}/global/networks/default"
  peer_network = "projects/${var.project_id}/global/networks/airqo-k8s-cluster"
}
# terraform import google_compute_network_peering.default_to_k8s ${var.project_id}/default/airqo-k8s-cluster