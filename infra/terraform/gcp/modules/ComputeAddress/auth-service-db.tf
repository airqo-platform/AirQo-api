resource "google_compute_address" "auth_service_db" {
  address_type = "EXTERNAL"
  description  = "mongo db for auth service"
  name         = "auth-service-db"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.auth_service_db projects/${var.project-id}/regions/europe-west1/addresses/auth-service-db
