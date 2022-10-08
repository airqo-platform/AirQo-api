resource "google_secret_manager_secret" "sta_env_view_api" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-view-api"
}
# terraform import google_secret_manager_secret.sta_env_view_api projects/${var.project-number}/secrets/sta-env-view-api
