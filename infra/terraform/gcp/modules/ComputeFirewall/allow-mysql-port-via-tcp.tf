resource "google_compute_firewall" "allow_mysql_port_via_tcp" {
  allow {
    ports    = ["3306"]
    protocol = "tcp"
  }

  description   = "allow remote access to MySQL db"
  direction     = "INGRESS"
  name          = "allow-mysql-port-via-tcp"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
}
# terraform import google_compute_firewall.allow_mysql_port_via_tcp projects/${var.project-id}/global/firewalls/allow-mysql-port-via-tcp
