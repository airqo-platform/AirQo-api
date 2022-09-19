resource "google_compute_firewall" "lamp_1_tcp_80" {
  allow {
    ports    = ["80"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "lamp-1-tcp-80"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["lamp-1-deployment"]
}
# terraform import google_compute_firewall.lamp_1_tcp_80 projects/airqo-250220/global/firewalls/lamp-1-tcp-80
