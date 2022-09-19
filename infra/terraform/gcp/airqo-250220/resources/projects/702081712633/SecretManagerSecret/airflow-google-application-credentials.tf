resource "google_secret_manager_secret" "airflow_google_application_credentials" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "airflow-google-application-credentials"
}
# terraform import google_secret_manager_secret.airflow_google_application_credentials projects/702081712633/secrets/airflow-google-application-credentials
