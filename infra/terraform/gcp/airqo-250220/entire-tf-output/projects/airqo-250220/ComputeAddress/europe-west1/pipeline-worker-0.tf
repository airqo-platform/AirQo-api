resource "google_compute_address" "pipeline_worker_0" {
  address      = "34.78.167.5"
  address_type = "EXTERNAL"
  name         = "pipeline-worker-0"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.pipeline_worker_0 projects/airqo-250220/regions/europe-west1/addresses/pipeline-worker-0
