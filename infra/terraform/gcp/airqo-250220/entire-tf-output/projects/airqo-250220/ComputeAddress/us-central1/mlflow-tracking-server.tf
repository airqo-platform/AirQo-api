resource "google_compute_address" "mlflow_tracking_server" {
  address      = "23.251.144.212"
  address_type = "EXTERNAL"
  name         = "mlflow-tracking-server"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "us-central1"
}
# terraform import google_compute_address.mlflow_tracking_server projects/airqo-250220/regions/us-central1/addresses/mlflow-tracking-server
