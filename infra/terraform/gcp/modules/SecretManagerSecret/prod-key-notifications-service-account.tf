resource "google_secret_manager_secret" "prod_key_notifications_service_account" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-key-notifications-service-account"
}
# terraform import google_secret_manager_secret.prod_key_notifications_service_account projects/${var.project-number}/secrets/prod-key-notifications-service-account
