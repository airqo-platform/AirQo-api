resource "google_compute_address" "airqo_devops_db" {
  description  = "This address is used as a connection string to self-managed MongoDB"
  name         = "airqo-devops-db"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.airqo_devops_db projects/${var.project-id}/regions/us-central1/addresses/airqo-devops-db
