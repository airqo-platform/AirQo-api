resource "google_compute_firewall" "test_mqtt_network_allow_http" {
  allow {
    ports    = ["80"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "test-mqtt-network-allow-http"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/test-mqtt-network"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server"]
}
# terraform import google_compute_firewall.test_mqtt_network_allow_http projects/airqo-250220/global/firewalls/test-mqtt-network-allow-http
