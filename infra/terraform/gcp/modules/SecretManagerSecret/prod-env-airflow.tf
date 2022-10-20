resource "google_secret_manager_secret" "prod_env_airflow" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-airflow"
}
# terraform import google_secret_manager_secret.prod_env_airflow projects/${var.project-number}/secrets/prod-env-airflow
