resource "google_compute_address" "pipeline_k8s_controller" {
  address      = "34.140.20.232"
  address_type = "EXTERNAL"
  name         = "pipeline-k8s-controller"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.pipeline_k8s_controller projects/airqo-250220/regions/europe-west1/addresses/pipeline-k8s-controller
