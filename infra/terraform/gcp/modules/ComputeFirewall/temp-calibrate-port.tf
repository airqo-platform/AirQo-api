resource "google_compute_firewall" "temp_calibrate_port" {
  allow {
    ports    = ["4001"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "temp-calibrate-port"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
  priority      = 0
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.temp_calibrate_port projects/${var.project-id}/global/firewalls/temp-calibrate-port
