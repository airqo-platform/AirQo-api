resource "google_secret_manager_secret" "sta_key_data_mgt_python_devices_transformation" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-key-data-mgt-python-devices-transformation"
}
# terraform import google_secret_manager_secret.sta_key_data_mgt_python_devices_transformation projects/${var.project-number}/secrets/sta-key-data-mgt-python-devices-transformation
