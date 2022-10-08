resource "google_secret_manager_secret" "prod_env_channel_data" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-channel-data"
}
# terraform import google_secret_manager_secret.prod_env_channel_data projects/${var.project-number}/secrets/prod-env-channel-data
