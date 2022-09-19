resource "google_secret_manager_secret" "prod_env_predict_api" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-predict-api"
}
# terraform import google_secret_manager_secret.prod_env_predict_api projects/702081712633/secrets/prod-env-predict-api
