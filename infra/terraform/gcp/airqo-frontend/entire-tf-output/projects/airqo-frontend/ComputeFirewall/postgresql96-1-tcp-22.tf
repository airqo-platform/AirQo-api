resource "google_compute_firewall" "postgresql96_1_tcp_22" {
  allow {
    ports    = ["22"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "postgresql96-1-tcp-22"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-frontend/global/networks/default"
  priority      = 1000
  project       = "airqo-frontend"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["postgresql96-1-tcp-22"]
}
# terraform import google_compute_firewall.postgresql96_1_tcp_22 projects/airqo-frontend/global/firewalls/postgresql96-1-tcp-22
