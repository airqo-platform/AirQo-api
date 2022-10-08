resource "google_compute_address" "airqo_haproxy" {
  address_type = "EXTERNAL"
  description  = "Haproxy is used to load balance and proxy request from platform.airqo.net to nginx-ingess-controller in k8s"
  name         = "airqo-haproxy"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.airqo_haproxy projects/${var.project-id}/regions/europe-west1/addresses/airqo-haproxy
