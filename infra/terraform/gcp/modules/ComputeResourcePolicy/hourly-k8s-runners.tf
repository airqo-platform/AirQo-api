resource "google_compute_resource_policy" "hourly_k8s_runners" {
  name   = "hourly-k8s-runners"
  region = var.region
  project = var.project_id
  description = "Start and stop instances that run the Kubernetes hourly cronjobs"
  instance_schedule_policy {
    vm_start_schedule {
      schedule = "40 * * * *"
    }
    vm_stop_schedule {
      schedule = "10 * * * *"
    }
    time_zone = "UTC"
  }
}
# terraform import google_compute_resource_policy.hourly_k8s_runners projects/${var.project_id}/regions/${var.region}/resourcePolicies/hourly-k8s-runners