resource "google_compute_firewall" "mqttbroker" {
  allow {
    ports    = ["1883"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "mqttbroker"
  network       = "default"
  priority      = 0
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.mqttbroker projects/${var.project-id}/global/firewalls/mqttbroker
