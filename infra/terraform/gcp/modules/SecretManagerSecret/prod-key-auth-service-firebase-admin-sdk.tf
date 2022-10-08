resource "google_secret_manager_secret" "prod_key_auth_service_firebase_admin_sdk" {
  project = var.project-number

  replication {
    automatic = true
  }

  secret_id = "prod-key-auth-service-firebase-admin-sdk"
}
# terraform import google_secret_manager_secret.prod_key_auth_service_firebase_admin_sdk projects/${var.project-number}/secrets/prod-key-auth-service-firebase-admin-sdk
