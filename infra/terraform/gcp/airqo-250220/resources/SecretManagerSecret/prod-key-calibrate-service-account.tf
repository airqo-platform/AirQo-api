resource "google_secret_manager_secret" "prod_key_calibrate_service_account" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-key-calibrate-service-account"
}
# terraform import google_secret_manager_secret.prod_key_calibrate_service_account projects/702081712633/secrets/prod-key-calibrate-service-account
