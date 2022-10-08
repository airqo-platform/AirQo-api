resource "google_secret_manager_secret" "sta_local_properties_mobile_app" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "sta-local-properties-mobile-app"
}
# terraform import google_secret_manager_secret.sta_local_properties_mobile_app projects/702081712633/secrets/sta-local-properties-mobile-app
