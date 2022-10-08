resource "google_secret_manager_secret" "prod_env_channel_data" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-channel-data"
}
# terraform import google_secret_manager_secret.prod_env_channel_data projects/702081712633/secrets/prod-env-channel-data
