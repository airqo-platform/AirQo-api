resource "google_secret_manager_secret" "sta_env_data_mgt_python" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-env-data-mgt-python"
}
# terraform import google_secret_manager_secret.sta_env_data_mgt_python projects/${var.project-number}/secrets/sta-env-data-mgt-python
