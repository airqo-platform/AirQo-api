resource "google_compute_global_address" "airqo_plus_subdomain" {
  address      = "34.117.156.65"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  name         = "airqo-plus-subdomain"
  project      = "airqo-frontend"
}
# terraform import google_compute_global_address.airqo_plus_subdomain projects/airqo-frontend/global/addresses/airqo-plus-subdomain
