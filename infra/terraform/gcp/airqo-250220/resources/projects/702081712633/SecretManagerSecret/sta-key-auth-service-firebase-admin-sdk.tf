resource "google_secret_manager_secret" "sta_key_auth_service_firebase_admin_sdk" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-key-auth-service-firebase-admin-sdk"
}
# terraform import google_secret_manager_secret.sta_key_auth_service_firebase_admin_sdk projects/702081712633/secrets/sta-key-auth-service-firebase-admin-sdk
