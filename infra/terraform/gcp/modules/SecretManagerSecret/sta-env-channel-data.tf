resource "google_secret_manager_secret" "sta_env_channel_data" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-channel-data"
}
# terraform import google_secret_manager_secret.sta_env_channel_data projects/${var.project-number}/secrets/sta-env-channel-data
