resource "google_compute_address" "mlflow_tracking_server" {
  address_type = "EXTERNAL"
  name         = "mlflow-tracking-server"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.mlflow_tracking_server projects/${var.project-id}/regions/us-central1/addresses/mlflow-tracking-server
