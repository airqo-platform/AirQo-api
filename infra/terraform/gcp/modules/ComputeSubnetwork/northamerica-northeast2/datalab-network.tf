resource "google_compute_subnetwork" "datalab_network" {
  ip_cidr_range = "10.188.0.0/20"
  name          = "datalab-network"
  network       = "datalab-network"
  project       = var.project-id
  purpose       = "PRIVATE"
  region        = "northamerica-northeast2"
  stack_type    = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.datalab_network projects/${var.project-id}/regions/northamerica-northeast2/subnetworks/datalab-network
