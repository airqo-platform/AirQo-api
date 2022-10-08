resource "google_secret_manager_secret" "sta_env_calibrate_api" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-calibrate-api"
}
# terraform import google_secret_manager_secret.sta_env_calibrate_api projects/${var.project-number}/secrets/sta-env-calibrate-api
