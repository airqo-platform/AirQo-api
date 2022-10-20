resource "google_secret_manager_secret" "sta_env_metadata" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-metadata"
}
# terraform import google_secret_manager_secret.sta_env_metadata projects/${var.project-number}/secrets/sta-env-metadata
