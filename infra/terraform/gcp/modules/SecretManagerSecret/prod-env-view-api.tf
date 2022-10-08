resource "google_secret_manager_secret" "prod_env_view_api" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-view-api"
}
# terraform import google_secret_manager_secret.prod_env_view_api projects/${var.project-number}/secrets/prod-env-view-api
