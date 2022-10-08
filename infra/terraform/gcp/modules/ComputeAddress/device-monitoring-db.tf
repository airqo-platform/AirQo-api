resource "google_compute_address" "device_monitoring_db" {
  address_type = "EXTERNAL"
  name         = "device-monitoring-db"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.device_monitoring_db projects/${var.project-id}/regions/europe-west1/addresses/device-monitoring-db
