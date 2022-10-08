resource "google_secret_manager_secret" "airflow_airnow_countries_metadata" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "airflow-airnow-countries-metadata"
}
# terraform import google_secret_manager_secret.airflow_airnow_countries_metadata projects/${var.project-number}/secrets/airflow-airnow-countries-metadata
