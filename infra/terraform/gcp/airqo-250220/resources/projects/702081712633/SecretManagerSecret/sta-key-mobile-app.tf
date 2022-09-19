resource "google_secret_manager_secret" "sta_key_mobile_app" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-key-mobile-app"
}
# terraform import google_secret_manager_secret.sta_key_mobile_app projects/702081712633/secrets/sta-key-mobile-app
