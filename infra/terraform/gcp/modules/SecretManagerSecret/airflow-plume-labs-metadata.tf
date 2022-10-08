resource "google_secret_manager_secret" "airflow_plume_labs_metadata" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "airflow-plume-labs-metadata"
}
# terraform import google_secret_manager_secret.airflow_plume_labs_metadata projects/${var.project-number}/secrets/airflow-plume-labs-metadata
