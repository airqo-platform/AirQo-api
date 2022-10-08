resource "google_secret_manager_secret" "prod_env_device_uptime" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-device-uptime"
}
# terraform import google_secret_manager_secret.prod_env_device_uptime projects/${var.project-number}/secrets/prod-env-device-uptime
