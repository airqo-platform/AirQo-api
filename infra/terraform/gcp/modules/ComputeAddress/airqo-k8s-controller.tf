resource "google_compute_address" "airqo_k8s_controller" {
  address_type = "EXTERNAL"
  description  = "This address is being used by k8s-controller on GCE Bare metal"
  name         = "airqo-k8s-controller"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.airqo_k8s_controller projects/${var.project-id}/regions/europe-west1/addresses/airqo-k8s-controller
