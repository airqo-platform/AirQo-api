resource "google_compute_firewall" "redis" {
  allow {
    ports    = ["6379"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "redis"
  network       = "default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.redis projects/${var.project-id}/global/firewalls/redis
