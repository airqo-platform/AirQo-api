resource "google_compute_firewall" "temp_calibrate_port" {
  allow {
    ports    = ["4001"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "temp-calibrate-port"
  network       = "default"
  priority      = 0
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.temp_calibrate_port projects/${var.project-id}/global/firewalls/temp-calibrate-port
