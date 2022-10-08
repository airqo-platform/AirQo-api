resource "google_compute_address" "airqo_k8s_dev_controller" {
  address_type = "EXTERNAL"
  name         = "airqo-k8s-dev-controller"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.airqo_k8s_dev_controller projects/${var.project-id}/regions/europe-west1/addresses/airqo-k8s-dev-controller
