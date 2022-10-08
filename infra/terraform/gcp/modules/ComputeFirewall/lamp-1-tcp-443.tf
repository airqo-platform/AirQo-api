resource "google_compute_firewall" "lamp_1_tcp_443" {
  allow {
    ports    = ["443"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "lamp-1-tcp-443"
  network       = "default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["lamp-1-deployment"]
}
# terraform import google_compute_firewall.lamp_1_tcp_443 projects/${var.project-id}/global/firewalls/lamp-1-tcp-443
