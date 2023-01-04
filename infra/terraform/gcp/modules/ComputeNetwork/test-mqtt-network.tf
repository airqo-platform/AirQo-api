resource "google_compute_network" "test_mqtt_network" {
  auto_create_subnetworks = false
  mtu                     = 1460
  name                    = "test-mqtt-network"
  project                 = var.project_id
  routing_mode            = "REGIONAL"
}
# terraform import google_compute_network.test_mqtt_network projects/${var.project_id}/global/networks/test-mqtt-network
