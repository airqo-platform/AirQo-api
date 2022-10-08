resource "google_secret_manager_secret" "prod_env_calibrate_app" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-calibrate-app"
}
# terraform import google_secret_manager_secret.prod_env_calibrate_app projects/${var.project-number}/secrets/prod-env-calibrate-app
