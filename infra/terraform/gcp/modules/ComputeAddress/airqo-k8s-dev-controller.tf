resource "google_compute_address" "airqo_k8s_dev_controller" {
  address      = "34.78.241.136"
  address_type = "EXTERNAL"
  name         = "airqo-k8s-dev-controller"
  network_tier = "PREMIUM"
  project      = "${var.project-id}"
  region       = "europe-west1"
}
# terraform import google_compute_address.airqo_k8s_dev_controller projects/airqo-250220/regions/europe-west1/addresses/airqo-k8s-dev-controller
