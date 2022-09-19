resource "google_secret_manager_secret" "airflow_plume_labs_metadata" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "airflow-plume-labs-metadata"
}
# terraform import google_secret_manager_secret.airflow_plume_labs_metadata projects/702081712633/secrets/airflow-plume-labs-metadata
