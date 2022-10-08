resource "google_secret_manager_secret" "prod_env_calibrate_api" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-calibrate-api"
}
# terraform import google_secret_manager_secret.prod_env_calibrate_api projects/${var.project-number}/secrets/prod-env-calibrate-api
