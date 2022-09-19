resource "google_compute_firewall" "redis" {
  allow {
    ports    = ["6379"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "redis"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.redis projects/airqo-250220/global/firewalls/redis
