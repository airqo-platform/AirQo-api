resource "google_compute_network" "datalab_network" {
  auto_create_subnetworks = true
  description             = "Network for Google Cloud Datalab instances"
  name                    = "datalab-network"
  project                 = "airqo-250220"
  routing_mode            = "REGIONAL"
}
# terraform import google_compute_network.datalab_network projects/airqo-250220/global/networks/datalab-network
