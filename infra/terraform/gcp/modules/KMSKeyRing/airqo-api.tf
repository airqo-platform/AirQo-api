resource "google_kms_key_ring" "airqo_api" {
  location = "eur3"
  name     = "airqo-api"
  project  = "${var.project-id}"
}
# terraform import google_kms_key_ring.airqo_api projects/airqo-250220/locations/eur3/keyRings/airqo-api
