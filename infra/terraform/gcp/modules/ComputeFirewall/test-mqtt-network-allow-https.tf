resource "google_compute_firewall" "test_mqtt_network_allow_https" {
  allow {
    ports    = ["443"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "test-mqtt-network-allow-https"
  network       = "test-mqtt-network"
  priority      = 1000
  project       = var.project_id
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["https-server"]
}
# terraform import google_compute_firewall.test_mqtt_network_allow_https projects/${var.project_id}/global/firewalls/test-mqtt-network-allow-https
