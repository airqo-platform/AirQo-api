resource "google_compute_subnetwork" "test_mqtt_network" {
  ip_cidr_range = "10.200.0.0/20"
  name          = "test-mqtt-network"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/test-mqtt-network"
  project       = var.project-id
  purpose       = "PRIVATE"
  region        = "europe-west9"
  stack_type    = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.test_mqtt_network projects/${var.project-id}/regions/europe-west9/subnetworks/test-mqtt-network
