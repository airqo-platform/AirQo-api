resource "google_compute_subnetwork" "datalab_network" {
  ip_cidr_range = "10.204.0.0/20"
  name          = "datalab-network"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/datalab-network"
  project       = var.project-id
  purpose       = "PRIVATE"
  region        = "europe-southwest1"
  stack_type    = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.datalab_network projects/${var.project-id}/regions/europe-southwest1/subnetworks/datalab-network
