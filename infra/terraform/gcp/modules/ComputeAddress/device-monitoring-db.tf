resource "google_compute_address" "device_monitoring_db" {
  address      = "34.140.46.94"
  address_type = "EXTERNAL"
  name         = "device-monitoring-db"
  network_tier = "PREMIUM"
  project      = "${var.project-id}"
  region       = "europe-west1"
}
# terraform import google_compute_address.device_monitoring_db projects/airqo-250220/regions/europe-west1/addresses/device-monitoring-db
