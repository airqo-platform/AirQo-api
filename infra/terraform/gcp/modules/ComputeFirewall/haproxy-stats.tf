resource "google_compute_firewall" "haproxy_stats" {
  allow {
    ports    = ["8181"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "haproxy-stats"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
  priority      = 1000
  project       = "${var.project-id}"
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.haproxy_stats projects/airqo-250220/global/firewalls/haproxy-stats
