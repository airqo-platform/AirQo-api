resource "google_compute_address" "device_registry_db" {
  address      = "34.79.121.214"
  address_type = "EXTERNAL"
  name         = "device-registry-db"
  network_tier = "PREMIUM"
  project      = "${var.project-id}"
  region       = "europe-west1"
}
# terraform import google_compute_address.device_registry_db projects/airqo-250220/regions/europe-west1/addresses/device-registry-db
