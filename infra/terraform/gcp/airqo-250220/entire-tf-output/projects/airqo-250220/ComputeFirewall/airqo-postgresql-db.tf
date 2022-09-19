resource "google_compute_firewall" "airqo_postgresql_db" {
  allow {
    ports    = ["5432"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "airqo-postgresql-db"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["airqo-postgresql-db"]
}
# terraform import google_compute_firewall.airqo_postgresql_db projects/airqo-250220/global/firewalls/airqo-postgresql-db
