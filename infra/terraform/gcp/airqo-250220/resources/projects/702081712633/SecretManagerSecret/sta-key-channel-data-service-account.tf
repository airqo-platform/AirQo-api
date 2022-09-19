resource "google_secret_manager_secret" "sta_key_channel_data_service_account" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-key-channel-data-service-account"
}
# terraform import google_secret_manager_secret.sta_key_channel_data_service_account projects/702081712633/secrets/sta-key-channel-data-service-account
