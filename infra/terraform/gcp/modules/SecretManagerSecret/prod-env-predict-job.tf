resource "google_secret_manager_secret" "prod_env_predict_job" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-predict-job"
}
# terraform import google_secret_manager_secret.prod_env_predict_job projects/${var.project-number}/secrets/prod-env-predict-job
