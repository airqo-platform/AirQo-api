resource "google_compute_network" "datalab_network" {
  auto_create_subnetworks = true
  description             = "Network for Google Cloud Datalab instances"
  name                    = "datalab-network"
  project                 = var.project-id
  routing_mode            = "REGIONAL"
}
# terraform import google_compute_network.datalab_network projects/${var.project-id}/global/networks/datalab-network
