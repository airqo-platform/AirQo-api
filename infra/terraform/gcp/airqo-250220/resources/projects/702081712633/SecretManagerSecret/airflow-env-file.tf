resource "google_secret_manager_secret" "airflow_env_file" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "airflow-env-file"
}
# terraform import google_secret_manager_secret.airflow_env_file projects/702081712633/secrets/airflow-env-file
