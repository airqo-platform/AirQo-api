resource "google_secret_manager_secret" "sta_key_data_mgt_python_devices_transformation" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-key-data-mgt-python-devices-transformation"
}
# terraform import google_secret_manager_secret.sta_key_data_mgt_python_devices_transformation projects/702081712633/secrets/sta-key-data-mgt-python-devices-transformation
