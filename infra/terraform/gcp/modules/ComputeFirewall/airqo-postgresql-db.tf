resource "google_compute_firewall" "airqo_postgresql_db" {
  allow {
    ports    = ["5432"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "airqo-postgresql-db"
  network       = "default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["airqo-postgresql-db"]
}
# terraform import google_compute_firewall.airqo_postgresql_db projects/${var.project-id}/global/firewalls/airqo-postgresql-db
