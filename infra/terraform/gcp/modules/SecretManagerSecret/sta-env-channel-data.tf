resource "google_secret_manager_secret" "sta_env_channel_data" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-channel-data"
}
# terraform import google_secret_manager_secret.sta_env_channel_data projects/702081712633/secrets/sta-env-channel-data
