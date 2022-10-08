resource "google_secret_manager_secret" "sta_key_data_mgt_python_service_account" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-key-data-mgt-python-service-account"
}
# terraform import google_secret_manager_secret.sta_key_data_mgt_python_service_account projects/${var.project-number}/secrets/sta-key-data-mgt-python-service-account
