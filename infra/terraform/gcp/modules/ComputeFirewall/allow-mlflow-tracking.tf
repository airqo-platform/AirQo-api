resource "google_compute_firewall" "allow_mlflow_tracking" {
  allow {
    ports    = ["5000"]
    protocol = "tcp"
  }

  direction     = "INGRESS"
  name          = "allow-mlflow-tracking"
  network       = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
  priority      = 1000
  project       = var.project-id
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["mlflow-tracking-server"]
}
# terraform import google_compute_firewall.allow_mlflow_tracking projects/${var.project-id}/global/firewalls/allow-mlflow-tracking
