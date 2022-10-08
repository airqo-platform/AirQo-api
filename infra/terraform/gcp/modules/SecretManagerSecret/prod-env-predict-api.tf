resource "google_secret_manager_secret" "prod_env_predict_api" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-predict-api"
}
# terraform import google_secret_manager_secret.prod_env_predict_api projects/${var.project-number}/secrets/prod-env-predict-api
