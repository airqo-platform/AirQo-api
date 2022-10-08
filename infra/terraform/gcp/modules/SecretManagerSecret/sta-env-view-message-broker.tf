resource "google_secret_manager_secret" "sta_env_view_message_broker" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-view-message-broker"
}
# terraform import google_secret_manager_secret.sta_env_view_message_broker projects/${var.project-number}/secrets/sta-env-view-message-broker
