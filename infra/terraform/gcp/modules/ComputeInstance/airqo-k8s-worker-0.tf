### Imported resource
resource "google_compute_instance" "airqo_k8s_worker_0" {
  resource_policies = ["https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/resourcePolicies/hourly-k8s-runners"]
}
# terraform import google_compute_instance.airqo_stage_k8s_worker_0 projects/${var.project_id}/zones/${var.zone}/instances/airqo-k8s-worker-0
