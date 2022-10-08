resource "google_secret_manager_secret" "sta_key_mobile_app" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-key-mobile-app"
}
# terraform import google_secret_manager_secret.sta_key_mobile_app projects/${var.project-number}/secrets/sta-key-mobile-app
