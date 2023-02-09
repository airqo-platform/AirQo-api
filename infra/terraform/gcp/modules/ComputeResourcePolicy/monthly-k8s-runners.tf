resource "google_compute_resource_policy" "monthly_k8s_runners" {
  name   = "monthly-k8s-runners"
  region = var.region
  project = var.project_id
  description = "Start and stop instances that run the Kubernetes monthly cronjobs"
  instance_schedule_policy {
    vm_start_schedule {
      schedule = "0 2 1 * *"
    }
    vm_stop_schedule {
      schedule = "0 4 1 * *"
    }
    time_zone = "Africa/Kampala"
  }
}
# terraform import google_compute_resource_policy.monthly_k8s_runners projects/${var.project_id}/regions/${var.region}/resourcePolicies/monthly-k8s-runners