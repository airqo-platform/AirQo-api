resource "google_secret_manager_secret" "prod_env_mobile_app" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "prod-env-mobile-app"
}
# terraform import google_secret_manager_secret.prod_env_mobile_app projects/${var.project-number}/secrets/prod-env-mobile-app
