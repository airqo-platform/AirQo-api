resource "google_secret_manager_secret" "sta_env_device_uptime" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-uptime"
}
# terraform import google_secret_manager_secret.sta_env_device_uptime projects/${var.project-number}/secrets/sta-env-device-uptime
