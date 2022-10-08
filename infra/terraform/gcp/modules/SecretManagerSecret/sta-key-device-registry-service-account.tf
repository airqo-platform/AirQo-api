resource "google_secret_manager_secret" "sta_key_device_registry_service_account" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-key-device-registry-service-account"
}
# terraform import google_secret_manager_secret.sta_key_device_registry_service_account projects/${var.project-number}/secrets/sta-key-device-registry-service-account
