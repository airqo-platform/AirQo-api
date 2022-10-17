resource "google_secret_manager_secret" "sta_env_airflow" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-airflow"
}
# terraform import google_secret_manager_secret.sta_env_airflow projects/${var.project-number}/secrets/sta-env-airflow
