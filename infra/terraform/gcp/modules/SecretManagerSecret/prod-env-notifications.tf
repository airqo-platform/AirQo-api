resource "google_secret_manager_secret" "prod_env_notifications" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-env-notifications"
}
# terraform import google_secret_manager_secret.prod_env_notifications projects/${var.project-number}/secrets/prod-env-notifications
