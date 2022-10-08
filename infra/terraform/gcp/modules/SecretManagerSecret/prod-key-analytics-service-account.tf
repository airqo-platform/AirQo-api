resource "google_secret_manager_secret" "prod_key_analytics_service_account" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-key-analytics-service-account"
}
# terraform import google_secret_manager_secret.prod_key_analytics_service_account projects/${var.project-number}/secrets/prod-key-analytics-service-account
