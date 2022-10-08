resource "google_secret_manager_secret" "airflow_google_application_credentials" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "airflow-google-application-credentials"
}
# terraform import google_secret_manager_secret.airflow_google_application_credentials projects/${var.project-number}/secrets/airflow-google-application-credentials
