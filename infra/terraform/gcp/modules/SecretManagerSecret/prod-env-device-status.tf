resource "google_secret_manager_secret" "prod_env_device_status" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-device-status"
}
# terraform import google_secret_manager_secret.prod_env_device_status projects/${var.project-number}/secrets/prod-env-device-status
