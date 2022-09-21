resource "google_compute_address" "pipeline_k8s_worker_1" {
  address      = "35.189.251.42"
  address_type = "EXTERNAL"
  name         = "pipeline-k8s-worker-1"
  network_tier = "PREMIUM"
  project      = "airqo-250220"
  region       = "europe-west1"
}
# terraform import google_compute_address.pipeline_k8s_worker_1 projects/airqo-250220/regions/europe-west1/addresses/pipeline-k8s-worker-1
