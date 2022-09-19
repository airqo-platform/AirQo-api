resource "google_secret_manager_secret" "prod_key_auth_service_firebase_admin_sdk" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-key-auth-service-firebase-admin-sdk"
}
# terraform import google_secret_manager_secret.prod_key_auth_service_firebase_admin_sdk projects/702081712633/secrets/prod-key-auth-service-firebase-admin-sdk
