resource "google_secret_manager_secret" "sta_env_device_registry" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-registry"
}
# terraform import google_secret_manager_secret.sta_env_device_registry projects/${var.project-number}/secrets/sta-env-device-registry
