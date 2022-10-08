resource "google_secret_manager_secret" "prod_env_auth_service" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-auth-service"
}
# terraform import google_secret_manager_secret.prod_env_auth_service projects/${var.project-number}/secrets/prod-env-auth-service
