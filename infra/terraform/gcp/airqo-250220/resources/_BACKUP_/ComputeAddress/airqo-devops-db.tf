resource "google_compute_address" "airqo_devops_db" {
  address      = "35.224.67.244"
  address_type = "EXTERNAL"
  description  = "This address is used as a connection string to self-managed MongoDB"
  name         = "airqo-devops-db"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "us-central1"
}
# terraform import google_compute_address.airqo_devops_db projects/airqo-250220/regions/us-central1/addresses/airqo-devops-db
