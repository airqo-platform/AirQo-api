resource "google_secret_manager_secret" "sta_env_mobile_app" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-env-mobile-app"
}
# terraform import google_secret_manager_secret.sta_env_mobile_app projects/${var.project-number}/secrets/sta-env-mobile-app
