resource "google_compute_subnetwork" "datalab_network" {
  ip_cidr_range = "10.202.0.0/20"
  name          = "datalab-network"
  network       = "datalab-network"
  project       = var.project-id
  purpose       = "PRIVATE"
  region        = "us-east5"
  stack_type    = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.datalab_network projects/${var.project-id}/regions/us-east5/subnetworks/datalab-network
