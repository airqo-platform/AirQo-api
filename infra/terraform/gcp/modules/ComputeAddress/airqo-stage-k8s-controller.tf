resource "google_compute_address" "airqo_stage_k8s_controller" {
  address_type = "EXTERNAL"
  name         = "airqo-stage-k8s-controller"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.airqo_stage_k8s_controller projects/${var.project-id}/regions/europe-west1/addresses/airqo-stage-k8s-controller
