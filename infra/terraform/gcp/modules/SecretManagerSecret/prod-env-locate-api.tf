resource "google_secret_manager_secret" "prod_env_locate_api" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-locate-api"
}
# terraform import google_secret_manager_secret.prod_env_locate_api projects/${var.project-number}/secrets/prod-env-locate-api
