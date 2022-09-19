resource "google_secret_manager_secret" "sta_env_device_registry" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-registry"
}
# terraform import google_secret_manager_secret.sta_env_device_registry projects/702081712633/secrets/sta-env-device-registry
