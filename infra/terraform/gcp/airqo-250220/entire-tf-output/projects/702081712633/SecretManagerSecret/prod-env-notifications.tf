resource "google_secret_manager_secret" "prod_env_notifications" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-notifications"
}
# terraform import google_secret_manager_secret.prod_env_notifications projects/702081712633/secrets/prod-env-notifications
