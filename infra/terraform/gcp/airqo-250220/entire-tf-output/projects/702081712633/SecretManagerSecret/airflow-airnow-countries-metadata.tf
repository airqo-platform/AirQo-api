resource "google_secret_manager_secret" "airflow_airnow_countries_metadata" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "airflow-airnow-countries-metadata"
}
# terraform import google_secret_manager_secret.airflow_airnow_countries_metadata projects/702081712633/secrets/airflow-airnow-countries-metadata
