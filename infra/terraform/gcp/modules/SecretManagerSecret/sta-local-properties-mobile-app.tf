resource "google_secret_manager_secret" "sta_local_properties_mobile_app" {
  project = "${var.project-number}"

  replication {
    automatic = true
  }

  secret_id = "sta-local-properties-mobile-app"
}
# terraform import google_secret_manager_secret.sta_local_properties_mobile_app projects/${var.project-number}/secrets/sta-local-properties-mobile-app
