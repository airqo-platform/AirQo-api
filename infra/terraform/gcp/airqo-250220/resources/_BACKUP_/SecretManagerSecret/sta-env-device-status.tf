resource "google_secret_manager_secret" "sta_env_device_status" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-device-status"
}
# terraform import google_secret_manager_secret.sta_env_device_status projects/702081712633/secrets/sta-env-device-status
