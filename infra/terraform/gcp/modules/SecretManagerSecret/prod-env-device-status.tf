resource "google_secret_manager_secret" "prod_env_device_status" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-device-status"
}
# terraform import google_secret_manager_secret.prod_env_device_status projects/702081712633/secrets/prod-env-device-status
