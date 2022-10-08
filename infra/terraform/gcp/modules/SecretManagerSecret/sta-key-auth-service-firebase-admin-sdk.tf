resource "google_secret_manager_secret" "sta_key_auth_service_firebase_admin_sdk" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "sta-key-auth-service-firebase-admin-sdk"
}
# terraform import google_secret_manager_secret.sta_key_auth_service_firebase_admin_sdk projects/${var.project-number}/secrets/sta-key-auth-service-firebase-admin-sdk
