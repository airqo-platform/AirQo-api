resource "google_secret_manager_secret" "airflow_env_file" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "airflow-env-file"
}
# terraform import google_secret_manager_secret.airflow_env_file projects/${var.project-number}/secrets/airflow-env-file
