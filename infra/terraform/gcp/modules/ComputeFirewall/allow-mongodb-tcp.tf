resource "google_compute_firewall" "allow_mongodb_tcp" {
  allow {
    ports    = ["27017", "17772-17779", "60001", "60002", "60003"]
    protocol = "tcp"
  }

  allow {
    ports    = ["6379"]
    protocol = "udp"
  }

  direction     = "INGRESS"
  name          = "allow-mongodb-tcp"
  network       = "airqo-k8s-cluster"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.allow_mongodb_tcp projects/${var.project-id}/global/firewalls/allow-mongodb-tcp
