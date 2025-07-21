resource "google_compute_resource_policy" "daily_dev_vms" {
  name   = "daily-dev-vms"
  region = var.region
  project = var.project_id
  description = "Start and stop development instances"
  instance_schedule_policy {
    vm_start_schedule {
      schedule = "45 01 * * *"
    }
    vm_stop_schedule {
      schedule = "45 18 * * *"
    }
    time_zone = "UTC"
  }
}
# terraform import google_compute_resource_policy.daily_dev_vms projects/${var.project_id}/regions/${var.region}/resourcePolicies/daily-dev-vms