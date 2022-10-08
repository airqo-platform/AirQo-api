resource "google_secret_manager_secret" "sta_env_device_status" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-status"
}
# terraform import google_secret_manager_secret.sta_env_device_status projects/${var.project-number}/secrets/sta-env-device-status
