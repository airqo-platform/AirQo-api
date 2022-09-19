resource "google_compute_address" "airqo_k8s_controller" {
  address      = "34.78.78.202"
  address_type = "EXTERNAL"
  description  = "This address is being used by k8s-controller on GCE Bare metal"
  name         = "airqo-k8s-controller"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.airqo_k8s_controller projects/airqo-250220/regions/europe-west1/addresses/airqo-k8s-controller
