resource "google_secret_manager_secret" "sta_env_view_message_broker" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-env-view-message-broker"
}
# terraform import google_secret_manager_secret.sta_env_view_message_broker projects/702081712633/secrets/sta-env-view-message-broker
