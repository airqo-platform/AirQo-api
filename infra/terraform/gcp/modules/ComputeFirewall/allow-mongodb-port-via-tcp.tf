resource "google_compute_firewall" "allow_mongodb_port_via_tcp" {
  allow {
    ports    = ["27017", "6379"]
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  direction     = "INGRESS"
  name          = "allow-mongodb-port-via-tcp"
  network       = "default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.allow_mongodb_port_via_tcp projects/${var.project-id}/global/firewalls/allow-mongodb-port-via-tcp
