resource "google_compute_network" "test_mqtt_network" {
  auto_create_subnetworks = true
  mtu                     = 1460
  name                    = "test-mqtt-network"
  project                 = var.project-id
  routing_mode            = "GLOBAL"
}
# terraform import google_compute_network.test_mqtt_network projects/${var.project-id}/global/networks/test-mqtt-network
