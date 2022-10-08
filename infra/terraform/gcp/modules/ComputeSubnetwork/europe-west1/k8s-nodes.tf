resource "google_compute_subnetwork" "k8s_nodes" {
  ip_cidr_range              = "10.240.0.0/24"
  name                       = "k8s-nodes"
  network                    = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/airqo-k8s-cluster"
  private_ipv6_google_access = "DISABLE_GOOGLE_ACCESS"
  project                    = var.project-id
  purpose                    = "PRIVATE"
  region                     = "europe-west1"
  stack_type                 = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.k8s_nodes projects/${var.project-id}/regions/europe-west1/subnetworks/k8s-nodes
