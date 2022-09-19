resource "google_compute_global_address" "airqo_and_staging_airqo" {
  address      = "34.117.250.30"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  name         = "airqo-and-staging-airqo"
  project      = "airqo-frontend"
}
# terraform import google_compute_global_address.airqo_and_staging_airqo projects/airqo-frontend/global/addresses/airqo-and-staging-airqo
