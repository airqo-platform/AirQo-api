resource "google_compute_address" "airqo_stage_k8s_controller" {
  address      = "104.155.124.180"
  address_type = "EXTERNAL"
  name         = "airqo-stage-k8s-controller"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.airqo_stage_k8s_controller projects/airqo-250220/regions/europe-west1/addresses/airqo-stage-k8s-controller
