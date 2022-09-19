resource "google_compute_address" "auth_service_db" {
  address      = "35.240.84.68"
  address_type = "EXTERNAL"
  description  = "mongo db for auth service"
  name         = "auth-service-db"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.auth_service_db projects/airqo-250220/regions/europe-west1/addresses/auth-service-db
