resource "google_compute_subnetwork" "test_mqtt_subnetwork" {
  ip_cidr_range              = "10.132.0.0/20"
  name                       = "test-mqtt-subnetwork"
  network                    = "test-mqtt-network"
  private_ipv6_google_access = "DISABLE_GOOGLE_ACCESS"
  project                    = var.project_id
  purpose                    = "PRIVATE"
  region                     = var.region
  stack_type                 = "IPV4_ONLY"
}
# terraform import google_compute_subnetwork.test_mqtt_subnetwork projects/${var.project_id}/regions/${var.region}/subnetworks/test-mqtt-subnetwork
