resource "google_secret_manager_secret" "prod_env_predict_job" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-predict-job"
}
# terraform import google_secret_manager_secret.prod_env_predict_job projects/702081712633/secrets/prod-env-predict-job
