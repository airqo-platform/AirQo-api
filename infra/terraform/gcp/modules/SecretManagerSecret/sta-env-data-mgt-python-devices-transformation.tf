resource "google_secret_manager_secret" "sta_env_data_mgt_python_devices_transformation" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-data-mgt-python-devices-transformation"
}
# terraform import google_secret_manager_secret.sta_env_data_mgt_python_devices_transformation projects/${var.project-number}/secrets/sta-env-data-mgt-python-devices-transformation
