resource "google_secret_manager_secret" "sta_key_channel_data_service_account" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-key-channel-data-service-account"
}
# terraform import google_secret_manager_secret.sta_key_channel_data_service_account projects/${var.project-number}/secrets/sta-key-channel-data-service-account
