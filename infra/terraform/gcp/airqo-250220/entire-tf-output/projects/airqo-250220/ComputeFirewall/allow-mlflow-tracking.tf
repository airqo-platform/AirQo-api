resource "google_compute_firewall" "allow_mlflow_tracking" {
  allow {
    ports    = ["5000"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "allow-mlflow-tracking"
  network       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/default"
  priority      = 1000
  project       = "airqo-250220"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["mlflow-tracking-server"]
}
# terraform import google_compute_firewall.allow_mlflow_tracking projects/airqo-250220/global/firewalls/allow-mlflow-tracking
