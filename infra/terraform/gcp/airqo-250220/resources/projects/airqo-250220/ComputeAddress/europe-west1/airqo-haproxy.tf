resource "google_compute_address" "airqo_haproxy" {
  address      = "35.240.91.160"
  address_type = "EXTERNAL"
  description  = "Haproxy is used to load balance and proxy request from platform.airqo.net to nginx-ingess-controller in k8s"
  name         = "airqo-haproxy"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.airqo_haproxy projects/airqo-250220/regions/europe-west1/addresses/airqo-haproxy
