resource "google_compute_firewall" "redis" {
  allow {
    ports    = ["6379"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "redis"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.redis projects/${var.project-id}/global/firewalls/redis
