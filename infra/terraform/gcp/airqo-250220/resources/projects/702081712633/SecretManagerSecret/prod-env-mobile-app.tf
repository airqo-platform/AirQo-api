resource "google_secret_manager_secret" "prod_env_mobile_app" {
  project = "702081712633"

  replication {
    automatic = true
  }

  secret_id = "prod-env-mobile-app"
}
# terraform import google_secret_manager_secret.prod_env_mobile_app projects/702081712633/secrets/prod-env-mobile-app
