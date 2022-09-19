resource "google_compute_firewall" "mqttbroker" {
  allow {
    ports    = ["1883"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "mqttbroker"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 0
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.mqttbroker projects/airqo-250220/global/firewalls/mqttbroker
