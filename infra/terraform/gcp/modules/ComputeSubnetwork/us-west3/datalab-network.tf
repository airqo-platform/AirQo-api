resource "google_compute_subnetwork" "datalab_network" {
  ip_cidr_range              = "10.180.0.0/20"
  name                       = "datalab-network"
  network                    = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/datalab-network"
  private_ipv6_google_access = "DISABLE_GOOGLE_ACCESS"
  project                    = var.project-id
  purpose                    = "PRIVATE"
  region                     = "us-west3"
  stack_type                 = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.datalab_network projects/${var.project-id}/regions/us-west3/subnetworks/datalab-network
